import { describe, expect, it } from "vitest";
import {
  PIPELINE_LENGTH,
  PIPELINE_STAGES,
  daysInStage,
  pipelineProgress,
} from "@/lib/advisor/pipelineProgress";
import type { PortalEventRecord } from "@/types/analytics";

function stageChanged(at: string): PortalEventRecord {
  return {
    id: `evt-${at}`,
    lead_id: "lead-1",
    event_name: "stage_changed",
    event_data: {},
    occurred_at: at,
    created_at: at,
  } as PortalEventRecord;
}

describe("pipelineProgress", () => {
  it("measures against 12 stages — NOT_A_FIT is excluded from the pipeline", () => {
    expect(PIPELINE_LENGTH).toBe(12);
    expect(PIPELINE_STAGES).not.toContain("NOT_A_FIT");
  });

  it("matches the handoff's worked example: Consultation Scheduled = Stage 6 of 12 = 50%", () => {
    const progress = pipelineProgress("CONSULTATION_SCHEDULED");
    expect(progress.number).toBe(6);
    expect(progress.total).toBe(12);
    expect(progress.percent).toBe(50);
    expect(progress.offPipeline).toBe(false);
  });

  it("reads 100% at the final stage, never beyond", () => {
    const progress = pipelineProgress("CLOSED_INVESTED");
    expect(progress.number).toBe(12);
    expect(progress.percent).toBe(100);
  });

  it("NOT_A_FIT is off-pipeline: no number, no percent", () => {
    const progress = pipelineProgress("NOT_A_FIT");
    expect(progress.offPipeline).toBe(true);
    expect(progress.number).toBeNull();
    expect(progress.percent).toBeNull();
  });

  it("an unknown stage falls back to NEW_LEAD rather than crashing the page", () => {
    const progress = pipelineProgress("SOMETHING_HIGHLEVEL_INVENTED");
    expect(progress.stage).toBe("NEW_LEAD");
    expect(progress.number).toBe(1);
  });

  it("days in stage counts from the latest stage_changed event", () => {
    const now = new Date("2026-08-26T12:00:00Z");
    const days = daysInStage(
      [stageChanged("2026-08-01T12:00:00Z"), stageChanged("2026-08-20T12:00:00Z")],
      "2026-07-01T00:00:00Z",
      now,
    );
    expect(days).toBe(6);
  });

  it("a lead that never moved has been in its stage since creation", () => {
    const now = new Date("2026-08-26T12:00:00Z");
    expect(daysInStage([], "2026-08-23T12:00:00Z", now)).toBe(3);
  });

  it("a clock skewed into the future reads null, not a negative age", () => {
    const now = new Date("2026-08-26T12:00:00Z");
    expect(daysInStage([], "2026-08-27T12:00:00Z", now)).toBeNull();
  });
});
