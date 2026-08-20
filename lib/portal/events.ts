import { hashToken } from "@/lib/portal/tokens";
import { recordLeadEvent } from "@/lib/domain/activities";
import { dispatchPortalEvent, type TrackPortalEventOptions } from "@/lib/tracking/dispatch";
import type { LeadRecord } from "@/types/lead";
import type { PortalEventName } from "@/types/analytics";

export interface TrackEventResult {
  /** Shared browser/server dedup ID for this event (spec §9) — thread this to the client to fire dataLayer/Pixel with the SAME id. */
  eventId: string;
  dataLayerPayload: Awaited<ReturnType<typeof dispatchPortalEvent>>["dataLayerPayload"];
  metaPixelBrowser: Awaited<ReturnType<typeof dispatchPortalEvent>>["metaPixelBrowser"];
}

/**
 * Records a funnel event (portal_events + activity_events via the central
 * activity service), forwards a copy to PostHog when configured, and
 * dispatches it through the centralized tracking layer (GTM dataLayer
 * contract, Meta Pixel/CAPI — lib/tracking/dispatch.ts). All writes are
 * fire-safe: analytics/tracking failures must never break the prospect's
 * flow (spec §5, §19). This is the single place every portal action routes
 * through — do not call recordLeadEvent or a tracking provider directly
 * from a page or route handler.
 *
 * Detailed financial answers stay in Supabase — only coarse metadata is
 * ever sent to third-party analytics/advertising platforms.
 */
export async function trackEvent(
  lead: LeadRecord,
  eventName: PortalEventName,
  eventData: Record<string, unknown> | null = null,
  pageUrl: string | null = null,
  trackingOptions: TrackPortalEventOptions = {},
): Promise<TrackEventResult> {
  const safeData = {
    ...(eventData ?? {}),
    source: lead.source,
    campaign: lead.campaign,
  };

  try {
    await recordLeadEvent(lead, eventName, safeData, pageUrl, { source: "portal" });
  } catch (error) {
    console.error(`[events] failed to store ${eventName}:`, error);
  }

  await sendToPostHog(lead, eventName, safeData);

  try {
    return await dispatchPortalEvent(lead, eventName, { pageUrl, ...trackingOptions });
  } catch (error) {
    console.error(`[tracking] dispatch failed for ${eventName} (event recorded regardless):`, error);
    const { generateEventId } = await import("@/lib/tracking/eventId");
    return { eventId: trackingOptions.eventId ?? generateEventId(), dataLayerPayload: null, metaPixelBrowser: null };
  }
}

async function sendToPostHog(
  lead: LeadRecord,
  eventName: string,
  properties: Record<string, unknown>,
): Promise<void> {
  const key = process.env.POSTHOG_KEY ?? process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;
  const host = (process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com").replace(/\/$/, "");

  try {
    const response = await fetch(`${host}/capture/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: key,
        event: eventName,
        distinct_id: hashToken(lead.portal_token),
        properties: {
          lead_id: lead.id,
          ...properties,
        },
        timestamp: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) {
      console.error(`[events] PostHog responded ${response.status} for ${eventName}`);
    }
  } catch (error) {
    console.error(`[events] PostHog capture failed for ${eventName}:`, error);
  }
}
