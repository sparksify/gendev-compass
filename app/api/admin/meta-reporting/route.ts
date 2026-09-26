import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizedAdminRequest } from "@/lib/advisor/adminAccess";
import { testMetaReportingConnection, syncMetaReporting } from "@/lib/analytics/metaReporting";
import { trackingEncryptionAvailable } from "@/lib/tracking/crypto";
import {
  clearMetaReportingAccessToken,
  resolveMetaReportingAccessToken,
  resolveMetaReportingAdAccountId,
  saveMetaReportingAccessToken,
} from "@/lib/tracking/settings";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

const schema = z.object({
  action: z.enum(["save", "test", "sync"]),
  enabled: z.boolean().optional(),
  adAccountId: z.string().trim().regex(/^(act_)?\d+$/).nullable().optional(),
  accessToken: z.string().trim().min(1).max(2000).optional(),
  clearAccessToken: z.boolean().optional(),
  timezone: z.string().trim().min(1).max(100).optional(),
  currency: z.string().trim().regex(/^[A-Z]{3}$/).optional(),
  attributionWindow: z.enum(["account_default"]).optional(),
});

function dateDaysAgo(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

export async function GET(request: Request): Promise<NextResponse> {
  if (!(await authorizedAdminRequest(request))) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const settings = await getStore().getTrackingSettings();
  return NextResponse.json({
    success: true,
    settings: {
      enabled: settings.meta_reporting_enabled,
      adAccountId: resolveMetaReportingAdAccountId(settings),
      accessTokenConfigured: Boolean(resolveMetaReportingAccessToken(settings)),
      timezone: settings.meta_reporting_timezone,
      currency: settings.meta_reporting_currency,
      attributionWindow: settings.meta_reporting_attribution_window,
      lastSyncAttemptAt: settings.meta_reporting_last_sync_attempt_at,
      lastSyncSuccessAt: settings.meta_reporting_last_sync_success_at,
      lastSyncStatus: settings.meta_reporting_last_sync_status,
      lastSyncError: settings.meta_reporting_last_sync_error,
    },
    encryptionAvailable: trackingEncryptionAvailable(),
  });
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!(await authorizedAdminRequest(request))) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid Meta reporting settings." }, { status: 400 });
  }
  const store = getStore();
  let settings = await store.getTrackingSettings();
  const now = new Date().toISOString();
  try {
    if (parsed.data.action === "save") {
      settings = await store.updateTrackingSettings(settings.id, {
        meta_reporting_enabled: parsed.data.enabled ?? false,
        meta_reporting_ad_account_id: parsed.data.adAccountId?.replace(/^act_/, "") ?? null,
        meta_reporting_timezone: parsed.data.timezone ?? "America/Chicago",
        meta_reporting_currency: parsed.data.currency ?? "USD",
        meta_reporting_attribution_window: parsed.data.attributionWindow ?? "account_default",
      });
      if (parsed.data.clearAccessToken) await clearMetaReportingAccessToken(settings.id);
      else if (parsed.data.accessToken) await saveMetaReportingAccessToken(settings.id, parsed.data.accessToken);
      return NextResponse.json({ success: true });
    }

    await store.updateTrackingSettings(settings.id, {
      meta_reporting_last_sync_attempt_at: now,
      meta_reporting_last_sync_status: "running",
      meta_reporting_last_sync_error: null,
    });
    const result = parsed.data.action === "test"
      ? await testMetaReportingConnection(settings)
      : await syncMetaReporting({ settings, since: dateDaysAgo(30), until: dateDaysAgo(0) });
    await store.updateTrackingSettings(settings.id, {
      meta_reporting_last_sync_success_at: new Date().toISOString(),
      meta_reporting_last_sync_status: "success",
      meta_reporting_last_sync_error: null,
    });
    return NextResponse.json({ success: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Meta reporting failed.";
    await store.updateTrackingSettings(settings.id, {
      meta_reporting_last_sync_status: "failed",
      meta_reporting_last_sync_error: message.slice(0, 500),
    });
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
