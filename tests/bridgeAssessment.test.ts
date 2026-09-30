import { describe, expect, it } from "vitest";
import {
  BRIDGE_STEPS,
  answerSnapshot,
  assessFit,
  bridgeAssessmentSchema,
} from "@/lib/bridge/assessment";
import {
  bridgeCapitalBand,
  bridgeCapitalDestination,
  bridgeCapitalMeetsMinimum,
} from "@/lib/config/qualification";

const valid = {
  goal: "replace-income",
  role: "lead-team",
  timeline: "within-3-months",
  city: "Austin",
  state: "tx",
  zip: "78701",
  liquidCapital: "250k-499k",
  priority: "territory",
  firstName: "Jordan",
  lastName: "Lee",
  email: "jordan@example.com",
  phone: "512-555-0100",
};

describe("bridge fit assessment", () => {
  it("has seven screens: six questions plus contact", () => {
    expect(BRIDGE_STEPS).toHaveLength(7);
    expect(BRIDGE_STEPS.at(-1)?.kind).toBe("contact");
  });

  it("accepts a complete submission and normalizes the state code", () => {
    const result = bridgeAssessmentSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.state).toBe("TX");
  });

  it("rejects an unknown option, a bad ZIP, and a missing phone", () => {
    expect(bridgeAssessmentSchema.safeParse({ ...valid, goal: "get-rich" }).success).toBe(false);
    expect(bridgeAssessmentSchema.safeParse({ ...valid, zip: "1234" }).success).toBe(false);
    expect(bridgeAssessmentSchema.safeParse({ ...valid, phone: "" }).success).toBe(false);
  });

  it("calls a strong fit only with qualifying capital and a near-term timeline", () => {
    expect(assessFit({ liquidCapital: "250k-499k", timeline: "asap" })).toBe("strong");
    expect(assessFit({ liquidCapital: "500k-plus", timeline: "3-6-months" })).toBe("strong");
    expect(assessFit({ liquidCapital: "50k-74k", timeline: "asap" })).toBe("standard");
    expect(assessFit({ liquidCapital: "75k-99k", timeline: "asap" })).toBe("strong");
    expect(assessFit({ liquidCapital: "25k-49k", timeline: "asap" })).toBe("standard");
    expect(assessFit({ liquidCapital: "250k-499k", timeline: "researching" })).toBe("standard");
    expect(assessFit({ liquidCapital: "not-sure", timeline: "asap" })).toBe("standard");
  });

  it("routes the $75,000 capital boundary conservatively", () => {
    expect(bridgeCapitalBand("50k-74k")).toBe("50k-74k");
    expect(bridgeCapitalMeetsMinimum("50k-74k")).toBe(false);
    expect(bridgeCapitalDestination("50k-74k")).toBe("financial-clarification");
    expect(bridgeCapitalBand("75k-99k")).toBe("75k-plus");
    expect(bridgeCapitalMeetsMinimum("75k-99k")).toBe(true);
    expect(bridgeCapitalDestination("75k-99k")).toBe("webinar");
    expect(bridgeCapitalDestination("lt-25k")).toBe("financial-education");
    expect(bridgeCapitalDestination("not-sure")).toBe("financial-clarification");
    // Older records used a single $50k–$99k value. They cannot prove the
    // new floor, so they return to clarification rather than advancing.
    expect(bridgeCapitalBand("50k-99k")).toBe("50k-74k");
    expect(bridgeCapitalMeetsMinimum("50k-99k")).toBe(false);
  });

  it("snapshots every answer with its question and human label", () => {
    const parsed = bridgeAssessmentSchema.parse({ ...valid, notes: "Looking at two brands." });
    const snapshot = answerSnapshot(parsed);
    expect(snapshot.map((a) => a.key)).toEqual([
      "goal",
      "role",
      "timeline",
      "liquidCapital",
      "priority",
      "location",
      "notes",
    ]);
    expect(snapshot.find((a) => a.key === "liquidCapital")?.label).toBe("$250,000–$499,999");
    expect(snapshot.find((a) => a.key === "location")?.value).toBe("Austin, TX 78701");
  });
});

import { knownLeadAssessmentSchema, BRIDGE_STEPS_KNOWN } from "@/lib/bridge/assessment";

describe("bridge page for a known lead", () => {
  it("drops the contact step and its fields", () => {
    expect(BRIDGE_STEPS_KNOWN).toHaveLength(6);
    expect(BRIDGE_STEPS_KNOWN.some((s) => s.kind === "contact")).toBe(false);
    const answersOnly = Object.fromEntries(
      Object.entries(valid).filter(([k]) => !["firstName", "lastName", "email", "phone"].includes(k)),
    );
    expect(knownLeadAssessmentSchema.safeParse(answersOnly).success).toBe(true);
    // Contact fields are simply ignored, never required.
    expect(knownLeadAssessmentSchema.safeParse(valid).success).toBe(true);
  });
});
