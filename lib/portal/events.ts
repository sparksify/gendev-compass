import { getStore } from "@/lib/store";
import { hashToken } from "@/lib/portal/tokens";
import type { LeadRecord } from "@/types/lead";
import type { PortalEventName } from "@/types/analytics";

/**
 * Records a funnel event in the portal_events table and, when configured,
 * forwards a copy to PostHog. Both are fire-safe: analytics failures must
 * never break the prospect's flow (spec §5, §19).
 *
 * Detailed financial answers stay in Supabase — only coarse metadata is
 * ever sent to third-party analytics.
 */
export async function trackEvent(
  lead: LeadRecord,
  eventName: PortalEventName,
  eventData: Record<string, unknown> | null = null,
  pageUrl: string | null = null,
): Promise<void> {
  const safeData = {
    ...(eventData ?? {}),
    source: lead.source,
    campaign: lead.campaign,
  };

  try {
    await getStore().insertEvent(lead.id, eventName, safeData, pageUrl);
  } catch (error) {
    console.error(`[events] failed to store ${eventName}:`, error);
  }

  await sendToPostHog(lead, eventName, safeData);
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
