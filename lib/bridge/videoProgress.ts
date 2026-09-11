import { getStore } from "@/lib/store";
import { trackEvent } from "@/lib/portal/events";
import { autoAdvanceStage } from "@/lib/advisor/stages";
import type { LeadRecord } from "@/types/lead";
import type { VideoProgressPayload } from "@/lib/validation/videoProgress";
import {
  BRIDGE_VIDEO_COMPLETION_PERCENT,
  BRIDGE_VIDEO_EVENT,
  BRIDGE_VIDEO_MILESTONES,
  bridgeVideoSummary,
  type BridgeVideoSummary,
} from "@/lib/bridge/videoSummary";

/**
 * Fraction of the completion threshold that must be genuinely watched
 * (Wistia's unique secondsWatched) before completion is accepted — the same
 * seek-to-end guard the portal's overview uses (lib/portal/progress.ts).
 */
const MIN_WATCH_RATIO = 0.5;

/**
 * Applies a bridge-video progress report from a known lead. Mirrors the
 * portal overview's tracking — start once, 25/50/75 once each, a stop
 * marker on every pause/end, completion once — but writes only events, so
 * the portal's own video_progress record is untouched.
 */
export async function applyBridgeVideoProgress(
  lead: LeadRecord,
  update: VideoProgressPayload,
): Promise<BridgeVideoSummary> {
  const store = getStore();
  const nowIso = new Date().toISOString();
  const events = await store.getEventsForLead(lead.id);
  const before = bridgeVideoSummary(events);
  const has = (name: string) => events.some((e) => e.event_name === name);
  const percent = Math.min(100, Math.max(0, update.percent));
  const data = { mediaId: update.mediaId ?? null };

  await store.updateLead(lead.id, { last_activity_at: nowIso });

  if (!has(BRIDGE_VIDEO_EVENT.started)) {
    await autoAdvanceStage(lead, "ENGAGED", "portal");
    await trackEvent(lead, BRIDGE_VIDEO_EVENT.started, data, "/watch");
  }

  for (const milestone of BRIDGE_VIDEO_MILESTONES) {
    if (percent >= milestone.percent && !has(milestone.event)) {
      await trackEvent(lead, milestone.event, { ...data, percent: milestone.percent }, "/watch");
    }
  }

  if (update.eventType === "pause" || update.eventType === "ended") {
    await trackEvent(
      lead,
      BRIDGE_VIDEO_EVENT.stopped,
      {
        ...data,
        percent: Math.round(percent * 10) / 10,
        currentTime: Math.round(update.currentTime),
        duration: Math.round(update.duration),
      },
      "/watch",
    );
  }

  const requiredSeconds =
    update.duration > 0 ? update.duration * (BRIDGE_VIDEO_COMPLETION_PERCENT / 100) * MIN_WATCH_RATIO : Infinity;
  const watchedEnough = (update.secondsWatched ?? 0) >= requiredSeconds;
  const reachedEnd = update.eventType === "ended" || percent >= BRIDGE_VIDEO_COMPLETION_PERCENT;
  if (!before.completed && reachedEnd && watchedEnough && !has(BRIDGE_VIDEO_EVENT.completed)) {
    await trackEvent(
      lead,
      BRIDGE_VIDEO_EVENT.completed,
      { ...data, highestPercent: Math.max(percent, before.highestPercent) },
      "/watch",
    );
  }

  return bridgeVideoSummary(await store.getEventsForLead(lead.id));
}
