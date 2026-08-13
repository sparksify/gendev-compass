import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizedAdminRequest } from "@/lib/advisor/adminAccess";
import { getStore } from "@/lib/store";
import { getEffectiveTrackingSettings, saveMetaCapiAccessToken, clearMetaCapiAccessToken } from "@/lib/tracking/settings";
import { trackingEncryptionAvailable } from "@/lib/tracking/crypto";
import { EVENT_TAXONOMY } from "@/lib/tracking/taxonomy";
import type { PortalEventName } from "@/types/analytics";
import type { TrackingEventOverride } from "@/types/tracking";

export const dynamic = "force-dynamic";

const GTM_ID_RE = /^GTM-[A-Z0-9]{4,}$/i;
const PIXEL_ID_RE = /^\d{5,20}$/;

const eventOverrideSchema = z.object({
  gtm: z.boolean().optional(),
  metaBrowser: z.boolean().optional(),
  metaCapi: z.boolean().optional(),
  metaEventName: z.string().trim().max(100).nullable().optional(),
});

const settingsSchema = z.object({
  gtmEnabled: z.boolean(),
  gtmContainerId: z
    .string()
    .trim()
    .regex(GTM_ID_RE, "Must look like GTM-XXXXXXX")
    .nullable()
    .optional(),
  metaEnabled: z.boolean(),
  metaBrowserMode: z.enum(["gtm", "direct", "server_only"]),
  metaPixelId: z.string().trim().regex(PIXEL_ID_RE, "Must be a numeric Pixel/Dataset ID").nullable().optional(),
  metaCapiEnabled: z.boolean(),
  /** Plaintext, write-only — never echoed back. Omit to leave the stored token unchanged. */
  metaCapiAccessToken: z.string().trim().min(1).max(1000).optional(),
  clearMetaCapiAccessToken: z.boolean().optional(),
  metaTestEventCode: z.string().trim().max(100).nullable().optional(),
  consentRequired: z.boolean(),
  marketingTrackingDefault: z.enum(["granted", "denied"]),
  eventOverrides: z.record(z.string(), eventOverrideSchema).optional(),
});

/** GET the current tracking configuration + status + event mapping table for /admin/tracking. */
export async function GET(request: Request): Promise<NextResponse> {
  if (!(await authorizedAdminRequest(request))) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const settings = await getEffectiveTrackingSettings();
  const warnings: string[] = [];
  if (settings.gtmEnabled && settings.metaEnabled && settings.metaBrowserMode === "direct") {
    warnings.push(
      "GTM and Direct Meta Pixel mode are both enabled. If the GTM container also fires a Meta Pixel tag, Meta events will double-fire. Only enable both when an expert has confirmed the GTM container does not manage the Pixel.",
    );
  }
  if (settings.raw.meta_capi_enabled && !settings.metaCapiAccessTokenConfigured) {
    warnings.push("Meta Conversions API is enabled but no access token is configured.");
  }
  if (!trackingEncryptionAvailable()) {
    warnings.push(
      "TRACKING_ENCRYPTION_KEY is not set — the Meta CAPI access token cannot be saved from this screen. Set the env var, or configure META_CAPI_ACCESS_TOKEN as a deploy-time fallback.",
    );
  }

  const taxonomy = (Object.keys(EVENT_TAXONOMY) as PortalEventName[]).map((eventName) => {
    const base = EVENT_TAXONOMY[eventName]!;
    const override: TrackingEventOverride | undefined = settings.raw.event_overrides[eventName];
    return {
      eventName,
      tier: base.tier,
      gtm: override?.gtm ?? base.gtm,
      metaBrowser: override?.metaBrowser ?? base.metaBrowser,
      metaCapi: override?.metaCapi ?? base.metaCapi,
      metaEventName: override?.metaEventName !== undefined ? override.metaEventName : base.metaEventName,
      overridden: Boolean(override),
    };
  });

  return NextResponse.json({
    success: true,
    settings: {
      gtmEnabled: settings.raw.gtm_enabled,
      gtmContainerId: settings.raw.gtm_container_id,
      gtmStatus: settings.raw.gtm_enabled ? (settings.gtmContainerId ? "connected" : "configuration_error") : "not_configured",
      metaEnabled: settings.raw.meta_enabled,
      metaBrowserMode: settings.raw.meta_browser_mode,
      metaPixelId: settings.raw.meta_pixel_id,
      metaBrowserStatus: settings.metaEnabled ? "connected" : "not_configured",
      metaCapiEnabled: settings.raw.meta_capi_enabled,
      metaCapiAccessTokenConfigured: settings.metaCapiAccessTokenConfigured,
      metaCapiStatus: settings.metaCapiEnabled ? "connected" : settings.raw.meta_capi_enabled ? "configuration_error" : "not_configured",
      metaTestEventCode: settings.raw.meta_test_event_code,
      consentRequired: settings.raw.consent_required,
      marketingTrackingDefault: settings.raw.marketing_tracking_default,
      eventOverrides: settings.raw.event_overrides,
      lastGtmTestAt: settings.raw.last_gtm_test_at,
      lastMetaBrowserTestAt: settings.raw.last_meta_browser_test_at,
      lastMetaCapiSuccessAt: settings.raw.last_meta_capi_success_at,
      lastMetaCapiFailureAt: settings.raw.last_meta_capi_failure_at,
      lastMetaCapiError: settings.raw.last_meta_capi_error,
    },
    warnings,
    taxonomy,
    encryptionAvailable: trackingEncryptionAvailable(),
  });
}

/** Save GTM / Meta browser / Meta CAPI / consent / event-mapping configuration. Takes effect immediately — no deploy required. */
export async function POST(request: Request): Promise<NextResponse> {
  if (!(await authorizedAdminRequest(request))) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid settings", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const input = parsed.data;

  const store = getStore();
  const current = await store.getTrackingSettings();

  try {
    await store.updateTrackingSettings(current.id, {
      gtm_enabled: input.gtmEnabled,
      gtm_container_id: input.gtmContainerId ?? null,
      meta_enabled: input.metaEnabled,
      meta_browser_mode: input.metaBrowserMode,
      meta_pixel_id: input.metaPixelId ?? null,
      meta_capi_enabled: input.metaCapiEnabled,
      meta_test_event_code: input.metaTestEventCode ?? null,
      consent_required: input.consentRequired,
      marketing_tracking_default: input.marketingTrackingDefault,
      ...(input.eventOverrides ? { event_overrides: input.eventOverrides } : {}),
    });

    if (input.clearMetaCapiAccessToken) {
      await clearMetaCapiAccessToken(current.id);
    } else if (input.metaCapiAccessToken) {
      await saveMetaCapiAccessToken(current.id, input.metaCapiAccessToken);
    }
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Save failed" },
      { status: 400 },
    );
  }

  return NextResponse.json({ success: true });
}
