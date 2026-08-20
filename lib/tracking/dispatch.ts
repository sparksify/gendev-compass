import { getStore } from "@/lib/store";
import { generateEventId } from "@/lib/tracking/eventId";
import { taxonomyFor } from "@/lib/tracking/taxonomy";
import { getEffectiveTrackingSettings, resolveMetaCapiAccessToken } from "@/lib/tracking/settings";
import { readConsentCookie, marketingAllowed } from "@/lib/tracking/consent";
import { sendMetaCapiEvent, type MetaCapiCustomerData } from "@/lib/tracking/metaCapi";
import { trackingDebugEnabled } from "@/lib/config/tracking";
import type { LeadRecord } from "@/types/lead";
import type { PortalEventName } from "@/types/analytics";
import type { MetaBrowserMode } from "@/types/tracking";

/**
 * Bounded retry schedule (spec §19): attempt 1 immediate, then +5m, +30m,
 * +2h. After the 3rd retry (4th attempt total) a failed CAPI delivery stops
 * retrying — see app/api/cron/tracking-retry/route.ts.
 */
const RETRY_DELAYS_MS = [5 * 60_000, 30 * 60_000, 2 * 60 * 60_000];

export interface TrackPortalEventOptions {
  /** Reuses a caller-supplied event ID instead of generating one — never generate a second ID for the same logical event (spec §9). */
  eventId?: string;
  pageUrl?: string | null;
  /** Non-sensitive fields to fire alongside the event; never questionnaire/financial data. */
  dataLayerExtras?: Record<string, string | number | boolean | null>;
  /** Opt-in Meta CAPI customer-matching + custom data — only passed by callers that consciously decide what leaves the portal (spec §10). */
  meta?: {
    customerData?: MetaCapiCustomerData;
    customData?: Record<string, unknown>;
    eventSourceUrl?: string;
  };
}

export interface DataLayerPayload {
  event: "portal_event";
  portal_event_name: string;
  event_id: string;
  lead_id: string;
  brand: string;
  qualification_status?: string;
  source?: string | null;
  campaign?: string | null;
  portal_stage?: string;
  [key: string]: unknown;
}

export interface TrackPortalEventResult {
  eventId: string;
  /** Null when GTM shouldn't fire for this event (disabled, or not in the taxonomy). */
  dataLayerPayload: DataLayerPayload | null;
  /** Direct-mode-only browser Pixel instructions; null unless meta_browser_mode is 'direct'. */
  metaPixelBrowser: { pixelId: string; eventName: string } | null;
}

/**
 * The single dispatch point every portal action routes through (spec §1).
 * Records nothing itself — the caller (lib/portal/events.ts trackEvent) has
 * already written the canonical event to portal_events/activity_events;
 * this function decides what downstream providers should receive and fires
 * the server-side ones (Meta CAPI), returning what the browser still needs
 * to do (dataLayer push / direct Pixel fire) so the calling API route can
 * hand it back to the client with the SAME event ID.
 */
export async function dispatchPortalEvent(
  lead: LeadRecord,
  eventName: PortalEventName,
  options: TrackPortalEventOptions = {},
): Promise<TrackPortalEventResult> {
  const eventId = options.eventId ?? generateEventId();
  const store = getStore();
  const settings = await getEffectiveTrackingSettings();
  const taxonomy = taxonomyFor(eventName);
  const override = settings.raw.event_overrides[eventName];

  const wantsGtm = override?.gtm ?? taxonomy?.gtm ?? false;
  const wantsMetaBrowser = override?.metaBrowser ?? taxonomy?.metaBrowser ?? false;
  const wantsMetaCapi = override?.metaCapi ?? taxonomy?.metaCapi ?? false;
  const metaEventName = override?.metaEventName !== undefined ? override.metaEventName : taxonomy?.metaEventName ?? null;

  let consentOk = true;
  try {
    const consent = await readConsentCookie();
    consentOk = marketingAllowed(settings.consentRequired, consent, settings.marketingTrackingDefault);
  } catch {
    // Outside a request context (unlikely for portal events) — default to
    // the configured default rather than blocking the event entirely.
    consentOk = settings.marketingTrackingDefault === "granted" || !settings.consentRequired;
  }

  if (trackingDebugEnabled()) {
    console.log(
      `[Tracking] ${eventName} event_id=${eventId} gtm=${settings.gtmEnabled && wantsGtm ? "pushed" : "skipped"} metaBrowser=${settings.metaEnabled && wantsMetaBrowser && consentOk ? settings.metaBrowserMode : "skipped"} metaServer=${settings.metaCapiEnabled && wantsMetaCapi && consentOk ? "queued" : "skipped"}`,
    );
  }

  // ---------------------------------------------------------------------
  // dataLayer (GTM) — the browser contract every future tag (Meta, GA4,
  // Google Ads, LinkedIn, TikTok) can trigger off (spec §11-§12).
  // ---------------------------------------------------------------------
  let dataLayerPayload: DataLayerPayload | null = null;
  if (settings.gtmEnabled && wantsGtm) {
    dataLayerPayload = {
      event: "portal_event",
      portal_event_name: eventName,
      event_id: eventId,
      lead_id: lead.id,
      brand: process.env.NEXT_PUBLIC_BRAND_NAME ?? "brand",
      source: lead.source,
      campaign: lead.campaign,
      ...(options.dataLayerExtras ?? {}),
    };
    await recordDelivery(store, lead.id, "gtm", eventName, null, eventId, "browser", "sent");
  } else if (taxonomy?.gtm) {
    await recordDelivery(store, lead.id, "gtm", eventName, null, eventId, "browser", "skipped");
  }

  // ---------------------------------------------------------------------
  // Meta browser (Pixel) — only "direct" mode fires from application code.
  // "gtm" mode relies entirely on the dataLayer push above (GTM owns the
  // Pixel tag); "server_only" never fires a browser event at all. Firing
  // both GTM-managed and direct Pixel code simultaneously is exactly the
  // double-fire bug spec §2 warns about — mode is mutually exclusive by
  // construction here.
  // ---------------------------------------------------------------------
  let metaPixelBrowser: TrackPortalEventResult["metaPixelBrowser"] = null;
  const metaBrowserEligible = settings.metaEnabled && wantsMetaBrowser && metaEventName && consentOk;
  if (metaBrowserEligible && settings.metaBrowserMode === "direct" && settings.metaPixelId) {
    metaPixelBrowser = { pixelId: settings.metaPixelId, eventName: metaEventName as string };
    await recordDelivery(store, lead.id, "meta_browser", eventName, metaEventName, eventId, "browser", "sent");
  } else if (metaBrowserEligible && settings.metaBrowserMode === "gtm") {
    // Handled via the dataLayer push above — GTM's Meta tag reads event_id
    // from the same payload for browser-side dedup against CAPI.
    await recordDelivery(store, lead.id, "meta_browser", eventName, metaEventName, eventId, "browser", "sent");
  } else if (taxonomy?.metaBrowser) {
    await recordDelivery(
      store,
      lead.id,
      "meta_browser",
      eventName,
      metaEventName,
      eventId,
      "browser",
      consentOk ? "skipped" : "suppressed",
    );
  }

  // ---------------------------------------------------------------------
  // Meta CAPI (server) — fire-safe: bounded by a short timeout and never
  // throws back to the caller (spec §19). A failure is queued for bounded
  // retry, not retried inline.
  // ---------------------------------------------------------------------
  if (settings.metaCapiEnabled && wantsMetaCapi && metaEventName && consentOk) {
    await dispatchMetaCapi(lead, eventName, metaEventName, eventId, options).catch((error) => {
      console.error(`[tracking] Meta CAPI dispatch threw for ${eventName}:`, error);
    });
  } else if (taxonomy?.metaCapi) {
    await recordDelivery(
      store,
      lead.id,
      "meta_capi",
      eventName,
      metaEventName,
      eventId,
      "server",
      consentOk ? "skipped" : "suppressed",
    );
  }

  return { eventId, dataLayerPayload, metaPixelBrowser };
}

async function dispatchMetaCapi(
  lead: LeadRecord,
  eventName: PortalEventName,
  metaEventName: string,
  eventId: string,
  options: TrackPortalEventOptions,
): Promise<void> {
  const store = getStore();
  const settings = await getEffectiveTrackingSettings();
  if (!settings.metaPixelId) return;
  const accessToken = resolveMetaCapiAccessToken(settings.raw);
  if (!accessToken) return;

  const customerData: MetaCapiCustomerData = {
    email: lead.email,
    phone: lead.phone,
    firstName: lead.first_name,
    lastName: lead.last_name,
    state: lead.state,
    externalId: lead.id,
    fbp: lead.first_fbp,
    fbc: lead.first_fbc,
    ...(options.meta?.customerData ?? {}),
  };

  const result = await sendMetaCapiEvent(settings.metaPixelId, accessToken, {
    eventName: metaEventName,
    eventId,
    eventTimeSeconds: Math.floor(Date.now() / 1000),
    eventSourceUrl: options.meta?.eventSourceUrl,
    customerData,
    customData: options.meta?.customData ?? null,
    testEventCode: settings.metaTestEventCode,
  });

  const sanitizedResponse = sanitizeProviderResponse(result.body);

  if (result.ok) {
    await recordDelivery(
      store,
      lead.id,
      "meta_capi",
      eventName,
      metaEventName,
      eventId,
      "server",
      settings.metaTestEventCode ? "test" : "sent",
      { responseCode: result.status, providerResponse: sanitizedResponse, sentAt: new Date().toISOString() },
    );
    await store.updateTrackingSettings(settings.raw.id, {
      last_meta_capi_success_at: new Date().toISOString(),
    });
  } else {
    const delivery = await recordDelivery(
      store,
      lead.id,
      "meta_capi",
      eventName,
      metaEventName,
      eventId,
      "server",
      "failed",
      {
        responseCode: result.status,
        providerResponse: sanitizedResponse,
        failedAt: new Date().toISOString(),
        attemptCount: 1,
        nextAttemptAt: new Date(Date.now() + RETRY_DELAYS_MS[0]).toISOString(),
      },
    );
    console.error(`[tracking] Meta CAPI delivery ${delivery.id} failed (status ${result.status}) for ${eventName}`);
    await store.updateTrackingSettings(settings.raw.id, {
      last_meta_capi_failure_at: new Date().toISOString(),
      last_meta_capi_error: summarizeError(sanitizedResponse),
    });
  }
}

/** Strips anything that could resemble a token/secret before it's stored or shown in the admin log. */
function sanitizeProviderResponse(body: unknown): Record<string, unknown> | null {
  if (!body || typeof body !== "object") return null;
  const clone = JSON.parse(JSON.stringify(body)) as Record<string, unknown>;
  delete clone.access_token;
  return clone;
}

function summarizeError(body: Record<string, unknown> | null): string {
  if (!body) return "Unknown error";
  const error = body.error as Record<string, unknown> | undefined;
  if (error && typeof error.message === "string") return error.message.slice(0, 500);
  return JSON.stringify(body).slice(0, 500);
}

async function recordDelivery(
  store: ReturnType<typeof getStore>,
  leadId: string,
  provider: "gtm" | "meta_browser" | "meta_capi",
  eventName: string,
  externalEventName: string | null,
  eventId: string,
  deliveryMode: "browser" | "server",
  status: "sent" | "skipped" | "failed" | "suppressed" | "test",
  extra: {
    responseCode?: number;
    providerResponse?: Record<string, unknown> | null;
    sentAt?: string;
    failedAt?: string;
    attemptCount?: number;
    nextAttemptAt?: string | null;
  } = {},
) {
  return store.insertTrackingDelivery({
    lead_id: leadId,
    provider,
    event_name: eventName,
    external_event_name: externalEventName,
    event_id: eventId,
    delivery_mode: deliveryMode,
    status,
    attempt_count: extra.attemptCount ?? 0,
    next_attempt_at: extra.nextAttemptAt ?? null,
    response_code: extra.responseCode ?? null,
    provider_response: extra.providerResponse ?? null,
    sent_at: extra.sentAt ?? null,
    failed_at: extra.failedAt ?? null,
  });
}

/** Re-attempts a failed Meta CAPI delivery — used by the retry cron. Bounded to RETRY_DELAYS_MS.length total retries. */
export async function retryMetaCapiDelivery(delivery: {
  id: string;
  lead_id: string | null;
  event_name: string;
  external_event_name: string | null;
  event_id: string;
  attempt_count: number;
}): Promise<void> {
  const store = getStore();
  if (!delivery.lead_id || !delivery.external_event_name) return;
  const lead = await store.getLeadById(delivery.lead_id);
  if (!lead) return;
  const settings = await getEffectiveTrackingSettings();
  if (!settings.metaCapiEnabled || !settings.metaPixelId) return;
  const accessToken = resolveMetaCapiAccessToken(settings.raw);
  if (!accessToken) return;

  const result = await sendMetaCapiEvent(settings.metaPixelId, accessToken, {
    eventName: delivery.external_event_name,
    eventId: delivery.event_id,
    eventTimeSeconds: Math.floor(Date.now() / 1000),
    customerData: {
      email: lead.email,
      phone: lead.phone,
      firstName: lead.first_name,
      lastName: lead.last_name,
      state: lead.state,
      externalId: lead.id,
      fbp: lead.first_fbp,
      fbc: lead.first_fbc,
    },
    testEventCode: settings.metaTestEventCode,
  });

  const sanitized = sanitizeProviderResponse(result.body);
  if (result.ok) {
    await store.updateTrackingDelivery(delivery.id, {
      status: settings.metaTestEventCode ? "test" : "sent",
      response_code: result.status,
      provider_response: sanitized,
      sent_at: new Date().toISOString(),
      failed_at: null,
    });
    return;
  }

  const nextAttempt = delivery.attempt_count; // attempt_count already includes the first failed try
  const nextDelay = RETRY_DELAYS_MS[nextAttempt];
  await store.updateTrackingDelivery(delivery.id, {
    attempt_count: delivery.attempt_count + 1,
    status: "failed",
    response_code: result.status,
    provider_response: sanitized,
    failed_at: new Date().toISOString(),
    next_attempt_at: nextDelay ? new Date(Date.now() + nextDelay).toISOString() : null,
  });
}

export type { MetaBrowserMode };
