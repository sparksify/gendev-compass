import { describe, expect, it } from "vitest";
import { buildBriefing } from "@/lib/advisor/briefing";
import type { InvestorRow } from "@/lib/advisor/investors";
import { hoursAgo, makeLead } from "./helpers";
import type { LeadRecord } from "@/types/lead";

/**
 * The dashboard's two derived summaries: the work-queue digest, which
 * collapses a queue that says the same thing N times into one sentence, and
 * the bottleneck note, which names the stage the pipeline is piling up in.
 *
 * Both are deliberately conservative — a mixed queue gets no summary, and an
 * evenly spread pipeline gets no bottleneck — so these tests pin the
 * suppression as tightly as the happy path.
 */

function makeRow(lead: LeadRecord, extra: Partial<InvestorRow> = {}): InvestorRow {
  return {
    lead,
    questionnaire: null,
    video: null,
    appointments: [],
    activeAppointment: null,
    fddStatus: "not_requested",
    advisor: null,
    followUp: { needed: false, reasons: [] },
    nextAction: "Monitor engagement",
    lastActivityAt: lead.last_activity_at ?? lead.created_at,
    client: null,
    opportunity: null,
    brand: null,
    clientOpportunities: [],
    stage: lead.current_stage,
    ...extra,
  };
}

/** A lead owed a follow-up for `reason`, last touched `days` ago. */
function overdue(name: string, reason: string, days: number, stage = "QUESTIONNAIRE_COMPLETED") {
  const at = hoursAgo(days * 24);
  return makeRow(
    makeLead({
      first_name: name,
      last_name: "Test",
      email: `${name.toLowerCase()}@example.test`,
      current_stage: stage as LeadRecord["current_stage"],
      questionnaire_completed_at: at,
      last_activity_at: at,
    }),
    { followUp: { needed: true, reasons: [reason] }, lastActivityAt: at },
  );
}

const SAME_REASON = "Questionnaire completed 22 days ago; no consultation booked.";

describe("work queue digest", () => {
  it("summarizes a queue where every row is overdue for the same reason", () => {
    const rows = ["Ana", "Ben", "Cara"].map((name) => overdue(name, SAME_REASON, 22));
    const { workQueue, workQueueDigest } = buildBriefing(rows);

    expect(workQueue).toHaveLength(3);
    expect(workQueueDigest.summary).toBe(
      "All 3 are follow-ups on questionnaire completed 22 days ago, no consultation booked — 22 days overdue.",
    );
  });

  it("says 'up to' when the rows are overdue by different amounts", () => {
    const rows = [overdue("Ana", SAME_REASON, 22), overdue("Ben", SAME_REASON, 9)];
    const { workQueueDigest } = buildBriefing(rows);

    expect(workQueueDigest.summary).toContain("up to 22 days overdue");
  });

  it("stays silent when the queue is mixed — a vague summary would flatten the difference", () => {
    const rows = [
      overdue("Ana", SAME_REASON, 22),
      overdue("Ben", "FDD sent 4 days ago; not yet acknowledged.", 4, "FDD_SENT"),
    ];
    const { workQueueDigest } = buildBriefing(rows);

    expect(workQueueDigest.summary).toBeNull();
  });

  it("stays silent when any row is merely warm rather than overdue", () => {
    const warm = makeRow(
      makeLead({
        first_name: "Dee",
        last_name: "Test",
        email: "dee@example.test",
        last_activity_at: hoursAgo(1),
      }),
    );
    const { workQueueDigest } = buildBriefing([overdue("Ana", SAME_REASON, 22), warm]);

    expect(workQueueDigest.summary).toBeNull();
  });

  it("offers a bulk mailto that BCCs everyone in the queue", () => {
    const rows = ["Ana", "Ben"].map((name) => overdue(name, SAME_REASON, 22));
    const { workQueueDigest } = buildBriefing(rows);

    expect(workQueueDigest.remindAllMailto).toContain("bcc=");
    expect(decodeURIComponent(workQueueDigest.remindAllMailto ?? "")).toContain(
      "ana@example.test,ben@example.test",
    );
  });

  it("has no bulk mailto for a single-row queue", () => {
    const { workQueueDigest } = buildBriefing([overdue("Ana", SAME_REASON, 22)]);
    expect(workQueueDigest.remindAllMailto).toBeNull();
  });
});

describe("pipeline bottleneck", () => {
  function atStage(stage: string, count: number): InvestorRow[] {
    return Array.from({ length: count }, (_, index) =>
      makeRow(
        makeLead({
          first_name: `P${index}`,
          last_name: stage,
          email: `p${index}-${stage}@example.test`,
          current_stage: stage as LeadRecord["current_stage"],
        }),
      ),
    );
  }

  it("names the stage holding a clear plurality, and the move that clears it", () => {
    const { bottleneck } = buildBriefing([
      ...atStage("NEW_LEAD", 8),
      ...atStage("QUESTIONNAIRE_COMPLETED", 2),
    ]);

    expect(bottleneck?.text).toBe("8 leads sit at Intro Call.");
    expect(bottleneck?.advice).toBe("Booking consultations is this week's highest-leverage move.");
  });

  it("uses the singular when exactly one lead is stuck", () => {
    const { bottleneck } = buildBriefing(atStage("NEW_LEAD", 1));
    expect(bottleneck?.text).toBe("1 lead sits at Intro Call.");
  });

  it("reports nothing when no stage dominates", () => {
    const { bottleneck } = buildBriefing([
      ...atStage("NEW_LEAD", 2),
      ...atStage("QUESTIONNAIRE_COMPLETED", 2),
      ...atStage("FDD_SENT", 2),
    ]);

    expect(bottleneck).toBeNull();
  });

  it("never calls the terminal stage a bottleneck — that is where clients belong", () => {
    const { bottleneck } = buildBriefing([
      ...atStage("CLOSED_INVESTED", 9),
      ...atStage("NEW_LEAD", 1),
    ]);

    expect(bottleneck).toBeNull();
  });

  it("reports nothing for an empty pipeline", () => {
    expect(buildBriefing([]).bottleneck).toBeNull();
  });
});
