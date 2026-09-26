import { NextResponse } from "next/server";
import { authorizedCron } from "@/lib/config/cron";
import { syncMetaReporting } from "@/lib/analytics/metaReporting";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

function day(daysAgo: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

export async function GET(request: Request): Promise<NextResponse> {
  if (!authorizedCron(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const store = getStore();
  const settings = await store.getTrackingSettings();
  if (!settings.meta_reporting_enabled) {
    return NextResponse.json({ success: true, skipped: "Meta reporting is disabled." });
  }
  const now = new Date().toISOString();
  await store.updateTrackingSettings(settings.id, {
    meta_reporting_last_sync_attempt_at: now,
    meta_reporting_last_sync_status: "running",
    meta_reporting_last_sync_error: null,
  });
  try {
    // Reconcile today plus the prior seven days because attribution totals can mature.
    const result = await syncMetaReporting({ settings, since: day(7), until: day(0) });
    await store.updateTrackingSettings(settings.id, {
      meta_reporting_last_sync_success_at: new Date().toISOString(),
      meta_reporting_last_sync_status: "success",
      meta_reporting_last_sync_error: null,
    });
    return NextResponse.json({ success: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Meta reporting sync failed.";
    await store.updateTrackingSettings(settings.id, {
      meta_reporting_last_sync_status: "failed",
      meta_reporting_last_sync_error: message.slice(0, 500),
    });
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
