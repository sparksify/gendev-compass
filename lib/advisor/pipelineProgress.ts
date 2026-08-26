import { INVESTOR_STAGES, STAGE_LABELS, type InvestorStage } from "@/types/advisor";
import type { PortalEventRecord } from "@/types/analytics";

/**
 * The ordered pipeline the slider measures against. NOT_A_FIT is excluded —
 * it is a terminal judgment, not a point on the way to closing, so a lead
 * sitting there has no meaningful "progress" to show.
 */
export const PIPELINE_STAGES: InvestorStage[] = INVESTOR_STAGES.filter(
  (stage) => stage !== "NOT_A_FIT",
);

export const PIPELINE_LENGTH = PIPELINE_STAGES.length;

export interface PipelineProgress {
  /** The lead's stage, as stored. */
  stage: InvestorStage;
  /** HighLevel-synced display label. */
  label: string;
  /** 1-based position, e.g. 6 for "Stage 6 of 12". Null when off-pipeline. */
  number: number | null;
  total: number;
  /** 0–100. Null when off-pipeline. */
  percent: number | null;
  /** True for NOT_A_FIT — the slider is replaced by a gray state. */
  offPipeline: boolean;
  /** Whole days since the stage last changed; null when never recorded. */
  daysInStage: number | null;
}

/**
 * Whole days since the most recent `stage_changed` event. Falls back to the
 * lead's creation date, which is when it entered its first stage — a lead
 * that has never moved has still been sitting somewhere since then.
 */
export function daysInStage(
  events: PortalEventRecord[],
  createdAt: string,
  now: Date = new Date(),
): number | null {
  const lastChange = events
    .filter((event) => event.event_name === "stage_changed")
    .map((event) => event.occurred_at ?? event.created_at)
    .sort((a, b) => b.localeCompare(a))[0];

  const since = lastChange ?? createdAt;
  const ms = now.getTime() - new Date(since).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  return Math.floor(ms / 86_400_000);
}

/**
 * Where a lead sits on the pipeline, for the client detail page's slider.
 *
 * Percent is `number / total` so the display and the fill agree: "Stage 6 of
 * 12" reads 50%, and the final stage reads 100%.
 */
export function pipelineProgress(
  stage: string,
  events: PortalEventRecord[] = [],
  createdAt: string = new Date().toISOString(),
  now: Date = new Date(),
): PipelineProgress {
  const known = (INVESTOR_STAGES as readonly string[]).includes(stage)
    ? (stage as InvestorStage)
    : "NEW_LEAD";
  const label = STAGE_LABELS[known] ?? stage;
  const days = daysInStage(events, createdAt, now);

  if (known === "NOT_A_FIT") {
    return {
      stage: known,
      label,
      number: null,
      total: PIPELINE_LENGTH,
      percent: null,
      offPipeline: true,
      daysInStage: days,
    };
  }

  const index = PIPELINE_STAGES.indexOf(known);
  const number = index + 1;
  return {
    stage: known,
    label,
    number,
    total: PIPELINE_LENGTH,
    percent: Math.round((number / PIPELINE_LENGTH) * 100),
    offPipeline: false,
    daysInStage: days,
  };
}
