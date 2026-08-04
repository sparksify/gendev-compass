import { getStore } from "@/lib/store";
import { getVideoCompletionThreshold } from "@/lib/config/qualification";
import { statusRank } from "@/lib/store/types";
import { trackEvent } from "@/lib/portal/events";
import type { LeadRecord } from "@/types/lead";
import type { VideoProgressRecord } from "@/types/portal";
import type { PortalEventName } from "@/types/analytics";

export interface VideoProgressUpdate {
  currentTime: number;
  duration: number;
  /** Highest of played-fraction / Wistia percentWatched, 0–100. */
  percent: number;
  /** Wistia's unique seconds watched, when available. */
  secondsWatched?: number;
  eventType: "play" | "timeupdate" | "pause" | "ended" | "heartbeat";
  mediaId?: string;
}

const MILESTONES: Array<{ percent: number; event: PortalEventName }> = [
  { percent: 25, event: "video_progress_25" },
  { percent: 50, event: "video_progress_50" },
  { percent: 75, event: "video_progress_75" },
];

/** Max wall-clock seconds credited per progress report (client reports ~every 10s). */
const MAX_ACCUMULATION_STEP_SECONDS = 30;

/**
 * Fraction of the threshold duration that must be genuinely accumulated
 * (wall-clock while playing / Wistia secondsWatched) before completion is
 * accepted. Below 1.0 to tolerate missed heartbeats and faster playback,
 * but high enough to reject dragging the playhead straight to the end.
 */
const MIN_WATCH_RATIO = 0.5;

export interface ApplyProgressResult {
  progress: VideoProgressRecord;
  completedNow: boolean;
  completed: boolean;
  highestPercent: number;
}

/**
 * Applies a client progress report. The server keeps the highest percent
 * ever reached (rewinds never reduce it), accumulates genuine watch time,
 * fires milestone events exactly once, and marks completion only when the
 * threshold is met by plausible watching (spec §11).
 */
export async function applyVideoProgress(
  lead: LeadRecord,
  update: VideoProgressUpdate,
): Promise<ApplyProgressResult> {
  const store = getStore();
  const existing = await store.getVideoProgress(lead.id);
  const now = new Date();
  const threshold = getVideoCompletionThreshold();

  const previousPercent = existing?.highest_percent_watched ?? 0;
  const reportedPercent = Math.min(100, Math.max(0, update.percent));

  // Accumulate genuine watch time: bounded wall-clock delta between reports,
  // upgraded to Wistia's own unique-seconds figure when it is larger.
  let accumulated = existing?.accumulated_seconds_watched ?? 0;
  if (existing?.last_event_at) {
    const deltaSeconds = (now.getTime() - new Date(existing.last_event_at).getTime()) / 1000;
    if (deltaSeconds > 0 && update.eventType !== "play") {
      accumulated += Math.min(deltaSeconds, MAX_ACCUMULATION_STEP_SECONDS);
    }
  }
  if (typeof update.secondsWatched === "number" && update.secondsWatched > accumulated) {
    accumulated = Math.min(update.secondsWatched, update.duration || update.secondsWatched);
  }
  accumulated = Math.round(accumulated);

  const highestPercent = Math.max(previousPercent, reportedPercent);

  // Completion requires the percent threshold plus enough accumulated
  // watch time that an instant seek-to-end is rejected.
  const requiredSeconds =
    update.duration > 0 ? (update.duration * (threshold / 100)) * MIN_WATCH_RATIO : Infinity;
  const alreadyCompleted = existing?.completed ?? false;
  const meetsThreshold = highestPercent >= threshold && accumulated >= requiredSeconds;
  const completed = alreadyCompleted || meetsThreshold;
  const completedNow = completed && !alreadyCompleted;

  const progress = await store.upsertVideoProgress(lead.id, {
    wistia_media_id: update.mediaId ?? existing?.wistia_media_id ?? null,
    highest_percent_watched: highestPercent,
    accumulated_seconds_watched: accumulated,
    last_playhead_position: update.currentTime,
    started: true,
    completed,
    last_event_at: now.toISOString(),
  });

  // First start: stamp the lead and fire the start event once.
  if (!existing?.started) {
    if (!lead.video_started_at) {
      await store.updateLead(lead.id, {
        video_started_at: now.toISOString(),
        ...(statusRank(lead.status) < statusRank("video_started")
          ? { status: "video_started" as const }
          : {}),
      });
    }
    await trackEvent(lead, "video_started", { mediaId: update.mediaId ?? null });
  } else if (
    statusRank(lead.status) < statusRank("video_in_progress") &&
    update.eventType !== "play"
  ) {
    await store.updateLead(lead.id, { status: "video_in_progress" });
  }

  // Milestones fire exactly once, on the crossing report.
  for (const milestone of MILESTONES) {
    if (previousPercent < milestone.percent && highestPercent >= milestone.percent) {
      await trackEvent(lead, milestone.event, { percent: milestone.percent });
    }
  }

  if (completedNow) {
    await store.updateLead(lead.id, {
      video_completed_at: now.toISOString(),
      ...(statusRank(lead.status) < statusRank("video_completed")
        ? { status: "video_completed" as const }
        : {}),
    });
    await trackEvent(lead, "video_completion_threshold_reached", {
      threshold,
      highestPercent,
      accumulatedSeconds: accumulated,
    });
  }

  return { progress, completedNow, completed, highestPercent };
}
