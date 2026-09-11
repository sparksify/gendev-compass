import type { PortalEventName, PortalEventRecord } from "@/types/analytics";

/**
 * The bridge video's engagement is kept as portal events rather than in
 * video_progress: that table holds exactly one record per lead and it is
 * the portal's Investor Overview — the "Video Watched" column, engagement
 * card, and questionnaire gate all read it. The 3-minute bridge cut is a
 * different video, so it gets its own stream through the same event
 * pipeline (timeline, PostHog, GTM/Meta dispatch) and is summarized from
 * those events wherever an advisor needs it.
 */

export const BRIDGE_VIDEO_EVENT = {
  started: "bridge_video_started",
  progress25: "bridge_video_progress_25",
  progress50: "bridge_video_progress_50",
  progress75: "bridge_video_progress_75",
  stopped: "bridge_video_stopped",
  completed: "bridge_video_completed",
} as const satisfies Record<string, PortalEventName>;

export const BRIDGE_VIDEO_MILESTONES: Array<{ percent: number; event: PortalEventName }> = [
  { percent: 25, event: BRIDGE_VIDEO_EVENT.progress25 },
  { percent: 50, event: BRIDGE_VIDEO_EVENT.progress50 },
  { percent: 75, event: BRIDGE_VIDEO_EVENT.progress75 },
];

/** Position percent at which the bridge cut counts as watched. */
export const BRIDGE_VIDEO_COMPLETION_PERCENT = 90;

export interface BridgeVideoSummary {
  started: boolean;
  /** Highest position reached, 0–100. */
  highestPercent: number;
  completed: boolean;
  /** Playhead (seconds) at the most recent pause/end, if any. */
  stoppedAtSeconds: number | null;
  durationSeconds: number | null;
  /** Number of pause/end reports — a rough "stops" count. */
  stops: number;
  firstEventAt: string | null;
  lastEventAt: string | null;
}

const EMPTY: BridgeVideoSummary = {
  started: false,
  highestPercent: 0,
  completed: false,
  stoppedAtSeconds: null,
  durationSeconds: null,
  stops: 0,
  firstEventAt: null,
  lastEventAt: null,
};

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function bridgeVideoSummary(events: PortalEventRecord[]): BridgeVideoSummary {
  const mine = events
    .filter((e) => e.event_name.startsWith("bridge_video_"))
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  if (mine.length === 0) return EMPTY;

  const summary: BridgeVideoSummary = { ...EMPTY };
  for (const event of mine) {
    const data = event.event_data ?? {};
    summary.firstEventAt ??= event.created_at;
    summary.lastEventAt = event.created_at;
    switch (event.event_name) {
      case BRIDGE_VIDEO_EVENT.started:
        summary.started = true;
        break;
      case BRIDGE_VIDEO_EVENT.progress25:
      case BRIDGE_VIDEO_EVENT.progress50:
      case BRIDGE_VIDEO_EVENT.progress75:
        summary.highestPercent = Math.max(summary.highestPercent, num(data.percent) ?? 0);
        break;
      case BRIDGE_VIDEO_EVENT.stopped:
        summary.stops += 1;
        summary.highestPercent = Math.max(summary.highestPercent, num(data.percent) ?? 0);
        summary.stoppedAtSeconds = num(data.currentTime);
        summary.durationSeconds = num(data.duration) ?? summary.durationSeconds;
        break;
      case BRIDGE_VIDEO_EVENT.completed:
        summary.completed = true;
        summary.highestPercent = Math.max(summary.highestPercent, num(data.highestPercent) ?? 100);
        break;
    }
  }
  summary.started = summary.started || summary.highestPercent > 0 || summary.stops > 0;
  summary.highestPercent = Math.min(100, Math.round(summary.highestPercent));
  return summary;
}
