import { getGhlConfig } from "@/lib/config/fdd";
import type { LeadRecord } from "@/types/lead";

/**
 * Pushes investor-overview video engagement to two HighLevel contact custom
 * fields so a Workflow's If/Else step can branch follow-up messaging on it:
 *
 *   contact.video_status    — "in_progress" | "completed" (empty = never
 *                              started; that's the "did you see your portal
 *                              link?" default branch, no value needed).
 *   contact.video__watched  — the percent, as plain text (e.g. "42"),
 *                              usable as a merge field in the message body.
 *
 * Field keys are overridable via env (GHL_VIDEO_STATUS_FIELD_KEY /
 * GHL_VIDEO_PERCENT_FIELD_KEY) in case they don't match what HighLevel
 * actually generated — confirm both in Settings → Custom Fields → Contact
 * before relying on this. Reuses the same GHL_API_TOKEN/GHL_LOCATION_ID
 * credentials as the FDD integration (lib/fdd/ghl.ts) — one set of
 * HighLevel credentials for the whole app.
 *
 * Fire-and-safe: called from lib/portal/progress.ts at video-start,
 * milestone, and completion points. A HighLevel outage or misconfiguration
 * must never disrupt the prospect's portal experience or throw back to the
 * caller — every failure is caught and logged here.
 */

const GHL_API_BASE = "https://services.leadconnectorhq.com";
const SYNC_TIMEOUT_MS = 8000;

const STATUS_FIELD_KEY = process.env.GHL_VIDEO_STATUS_FIELD_KEY ?? "contact.video_status";
const PERCENT_FIELD_KEY = process.env.GHL_VIDEO_PERCENT_FIELD_KEY ?? "contact.video__watched";

export type VideoSyncStatus = "in_progress" | "completed";

export async function syncVideoProgressToGhl(
  lead: LeadRecord,
  input: { percent: number; status: VideoSyncStatus },
): Promise<void> {
  const config = getGhlConfig();
  // Contact custom-field writes require API mode specifically (not the
  // inbound-webhook-only FDD fallback) — silently skip when unconfigured,
  // same as every other optional integration in this app.
  if (!config.apiToken || !config.locationId) return;

  try {
    const response = await fetch(`${GHL_API_BASE}/contacts/upsert`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiToken}`,
        "Content-Type": "application/json",
        Version: "2021-07-28",
      },
      body: JSON.stringify({
        locationId: config.locationId,
        email: lead.email,
        phone: lead.phone ?? undefined,
        customFields: [
          { key: STATUS_FIELD_KEY, field_value: input.status },
          { key: PERCENT_FIELD_KEY, field_value: String(Math.round(input.percent)) },
        ],
      }),
      signal: AbortSignal.timeout(SYNC_TIMEOUT_MS),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.error(
        `[ghl-video-sync] contact upsert responded ${response.status} for lead ${lead.id}: ${body.slice(0, 300)}`,
      );
    }
  } catch (error) {
    console.error(`[ghl-video-sync] failed for lead ${lead.id}:`, error);
  }
}
