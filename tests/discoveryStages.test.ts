import { describe, expect, it } from "vitest";
import {
  DISCOVERY_STAGES,
  discoveryStageFor,
  discoveryStageIdFor,
  granularStagesFor,
  stageChipFor,
} from "@/lib/advisor/discoveryStages";
import { buildBriefing } from "@/lib/advisor/briefing";
import { evaluateFollowUp } from "@/lib/advisor/followUp";
import { suggestNextAction } from "@/lib/advisor/nextAction";
import type { InvestorRow } from "@/lib/advisor/investors";
import { INVESTOR_STAGES } from "@/types/advisor";
import { hoursAgo, makeLead, makeVideo } from "./helpers";
import type { LeadRecord } from "@/types/lead";

function makeRow(lead: LeadRecord, overrides: Partial<InvestorRow> = {}): InvestorRow {
  const video = overrides.video ?? null;
  return {
    lead,
    questionnaire: null,
    video,
    appointments: [],
    activeAppointment: null,
    fddStatus: lead.fdd_status,
    advisor: null,
    followUp: evaluateFollowUp({ lead, appointments: [], video }),
    nextAction: suggestNextAction(lead, [], video),
    lastActivityAt: lead.last_activity_at ?? lead.created_at,
    client: null,
    opportunity: null,
    brand: null,
    clientOpportunities: [],
    stage: lead.current_stage,
    ...overrides,
  };
}

describe("the 5-stage discovery model", () => {
  it("maps every granular stage except NOT_A_FIT onto exactly one discovery stage", () => {
    for (const stage of INVESTOR_STAGES) {
      const id = discoveryStageIdFor(stage);
      if (stage === "NOT_A_FIT") {
        expect(id).toBeNull();
      } else {
        expect(id).not.toBeNull();
        expect(granularStagesFor(id!)).toContain(stage);
      }
    }
  });

  it("moves forward through the stages as the pipeline advances", () => {
    const ids = [
      "NEW_LEAD",
      "QUESTIONNAIRE_COMPLETED",
      "FDD_SENT",
      "DUE_DILIGENCE",
      "CLOSED_INVESTED",
    ].map(discoveryStageIdFor);
    expect(ids).toEqual([1, 2, 3, 4, 5]);
  });

  it("round-trips each stage's entry stage back to itself", () => {
    for (const stage of DISCOVERY_STAGES) {
      expect(discoveryStageIdFor(stage.entryStage)).toBe(stage.id);
    }
  });

  it("labels a not-a-fit lead without a stage color", () => {
    expect(discoveryStageFor("NOT_A_FIT")).toBeNull();
    expect(stageChipFor("NOT_A_FIT").label).toBe("Not a fit");
    expect(stageChipFor("FDD_SENT").label).toBe("FDD & Territory");
  });
});

describe("the daily briefing", () => {
  it("counts the pipeline by discovery stage and leaves out not-a-fit leads", () => {
    const rows = [
      makeRow(makeLead({ current_stage: "NEW_LEAD" })),
      makeRow(makeLead({ current_stage: "ENGAGED" })),
      makeRow(makeLead({ current_stage: "FDD_SENT" })),
      makeRow(makeLead({ current_stage: "NOT_A_FIT" })),
    ];
    const briefing = buildBriefing(rows);

    expect(briefing.pipeline.total).toBe(3);
    expect(briefing.pipeline.segments.map((segment) => segment.count)).toEqual([2, 0, 1, 0, 0]);
  });

  it("averages video watch over the clients who actually started it", () => {
    const rows = [
      makeRow(makeLead(), { video: makeVideo({ highest_percent_watched: 100, completed: true }) }),
      makeRow(makeLead(), { video: makeVideo({ highest_percent_watched: 50 }) }),
      makeRow(makeLead()),
    ];
    const briefing = buildBriefing(rows);

    expect(briefing.videoWatch.averagePercent).toBe(75);
    expect(briefing.videoWatch.completed).toBe(1);
  });

  it("puts overdue follow-ups at the top of the work queue, oldest first", () => {
    const stale = makeLead({
      questionnaire_completed_at: hoursAgo(96),
      last_activity_at: hoursAgo(96),
    });
    const recent = makeLead({
      questionnaire_completed_at: hoursAgo(30),
      last_activity_at: hoursAgo(30),
    });
    const quiet = makeLead({ last_activity_at: hoursAgo(2) });

    const briefing = buildBriefing([makeRow(quiet), makeRow(recent), makeRow(stale)]);

    expect(briefing.followUps.count).toBe(2);
    expect(briefing.workQueue[0].leadId).toBe(stale.id);
    expect(briefing.workQueue[0].marker).toEqual({ kind: "overdue", label: "OVERDUE · 4D" });
    expect(briefing.workQueue[2].marker).toEqual({ kind: "warm" });
  });

  it("reports conversion as the share who reached the next stage", () => {
    const rows = [
      makeRow(makeLead({ current_stage: "NEW_LEAD" })),
      makeRow(makeLead({ current_stage: "NEW_LEAD" })),
      makeRow(makeLead({ current_stage: "QUESTIONNAIRE_COMPLETED" })),
      makeRow(makeLead({ current_stage: "FDD_SENT" })),
    ];
    const briefing = buildBriefing(rows);

    // 4 reached stage 1, 2 of them reached stage 2 → 50%.
    expect(briefing.conversion[0].percent).toBe(50);
    // 2 reached stage 2, 1 reached stage 3 → 50%.
    expect(briefing.conversion[1].percent).toBe(50);
    // Nobody reached stage 4, so the last step has no denominator.
    expect(briefing.conversion[3].percent).toBeNull();
  });

  it("lists only the last 24 hours of activity, newest first", () => {
    const fresh = makeLead({ questionnaire_completed_at: hoursAgo(2) });
    const old = makeLead({ questionnaire_completed_at: hoursAgo(50) });
    const briefing = buildBriefing([makeRow(old), makeRow(fresh)]);

    expect(briefing.recentActivity).toHaveLength(1);
    expect(briefing.recentActivity[0].leadId).toBe(fresh.id);
    expect(briefing.recentActivity[0].text).toBe("completed the questionnaire");
  });
});
