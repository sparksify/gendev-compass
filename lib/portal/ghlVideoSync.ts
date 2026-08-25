import { getGhlConfig } from "@/lib/config/fdd";
import type { LeadRecord } from "@/types/lead";

/**
 * Pushes investor-overview video engagement to HighLevel: two contact
 * custom fields for message personalization, and tags for reliable
 * Workflow triggers/exit-goals (tag-added/has-tag is the well-supported
 * trigger type in HighLevel; custom-field-changed triggers are shakier).
 *
 *   contact.video_status    — "in_progress" | "high_engagement" | "completed"
 *                              (empty = never started). "high_engagement"
 *                              kicks in at getVideoHighEngagementThreshold()
 *                              (default 50%) — see lib/config/qualification.ts.
 *   contact.video__watched  — the percent, as plain text (e.g. "42"), usable
 *                              as a merge field in message copy.
 *
 *   Tags (one per tier, mutually exclusive): video_started,
 *   video_high_engagement, video_completed. Advancing to a tier adds its tag
 *   and removes every earlier tier's tag, so "Tag Added: video_started" and
 *   "Has tag: video_high_engagement" are clean, current-state triggers a
 *   Workflow can route/exit on — instead of an If/Else before every message.
 *
 * Field keys / tag names are overridable via env in case they don't match
 * what HighLevel actually generated — confirm in Settings → Custom Fields →
 * Contact before relying on this. Reuses the same GHL_API_TOKEN/
 * GHL_LOCATION_ID credentials as the FDD integration (lib/fdd/ghl.ts).
 *
 * Fire-and-safe: called from lib/portal/progress.ts at video-start,
 * milestone, and completion points. A HighLevel outage or misconfiguration
 * must never disrupt the prospect's portal experience or throw back to the
 * caller — every failure is caught and logged here.
 */

const GHL_API_BASE = "https://services.leadconnectorhq.com";
const SYNC_TIMEOUT_MS = 8000;
const API_VERSION = "2021-07-28";

const STATUS_FIELD_KEY = process.env.GHL_VIDEO_STATUS_FIELD_KEY ?? "contact.video_status";
const PERCENT_FIELD_KEY = process.env.GHL_VIDEO_PERCENT_FIELD_KEY ?? "contact.video__watched";

export type VideoSyncStatus = "in_progress" | "high_engagement" | "completed";

/** Forward-only tier order — advancing to a later tier removes every earlier tier's tag. */
const TIER_ORDER: VideoSyncStatus[] = ["in_progress", "high_engagement", "completed"];

const TIER_TAG: Record<VideoSyncStatus, string> = {
  in_progress: process.env.GHL_VIDEO_STARTED_TAG ?? "video_started",
  high_engagement: process.env.GHL_VIDEO_HIGH_ENGAGEMENT_TAG ?? "video_high_engagement",
  completed: process.env.GHL_VIDEO_COMPLETED_TAG ?? "video_completed",
};

function authHeaders(apiToken: string): HeadersInit {
  return {
    Authorization: `Bearer ${apiToken}`,
    "Content-Type": "application/json",
    Version: API_VERSION,
  };
}

export async function syncVideoProgressToGhl(
  lead: LeadRecord,
  input: { percent: number; status: VideoSyncStatus },
): Promise<void> {
  const config = getGhlConfig();
  // Contact writes require API mode specifically (not the inbound-webhook-
  // only FDD fallback) — silently skip when unconfigured, same as every
  // other optional integration in this app.
  if (!config.apiToken || !config.locationId) return;

  const tierIndex = TIER_ORDER.indexOf(input.status);
  const addTag = TIER_TAG[input.status];
  const removeTags = TIER_ORDER.slice(0, tierIndex).map((tier) => TIER_TAG[tier]);

  let contactId: string | null = null;
  try {
    const response = await fetch(`${GHL_API_BASE}/contacts/upsert`, {
      method: "POST",
      headers: authHeaders(config.apiToken),
      body: JSON.stringify({
        locationId: config.locationId,
        email: lead.email,
        phone: lead.phone ?? undefined,
        customFields: [
          { key: STATUS_FIELD_KEY, field_value: input.status },
          { key: PERCENT_FIELD_KEY, field_value: String(Math.round(input.percent)) },
        ],
        // Upsert additively applies tags — it never removes the ones below,
        // so the tier-tag cleanup still needs the explicit remove call.
        tags: [addTag],
      }),
      signal: AbortSignal.timeout(SYNC_TIMEOUT_MS),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.error(
        `[ghl-video-sync] contact upsert responded ${response.status} for lead ${lead.id}: ${body.slice(0, 300)}`,
      );
      return;
    }
    const data = (await response.json().catch(() => null)) as { contact?: { id?: string } } | null;
    contactId = data?.contact?.id ?? null;
  } catch (error) {
    console.error(`[ghl-video-sync] contact upsert failed for lead ${lead.id}:`, error);
    return;
  }

  if (removeTags.length === 0 || !contactId) return;

  try {
    const response = await fetch(`${GHL_API_BASE}/contacts/${contactId}/tags`, {
      method: "DELETE",
      headers: authHeaders(config.apiToken),
      body: JSON.stringify({ tags: removeTags }),
      signal: AbortSignal.timeout(SYNC_TIMEOUT_MS),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.error(
        `[ghl-video-sync] tag removal responded ${response.status} for lead ${lead.id}: ${body.slice(0, 300)}`,
      );
    }
  } catch (error) {
    console.error(`[ghl-video-sync] tag removal failed for lead ${lead.id}:`, error);
  }
}
