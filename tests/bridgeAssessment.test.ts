import { describe, expect, it } from "vitest";
import {
  BRIDGE_STEPS,
  answerSnapshot,
  assessFit,
  bridgeAssessmentSchema,
} from "@/lib/bridge/assessment";

const valid = {
  goal: "replace-income",
  role: "lead-team",
  timeline: "within-3-months",
  city: "Austin",
  state: "tx",
  zip: "78701",
  investmentLevel: "125k-200k",
  liquidCapital: "250k-499k",
  priority: "territory",
  firstName: "Jordan",
  lastName: "Lee",
  email: "jordan@example.com",
  phone: "512-555-0100",
};

describe("bridge fit assessment", () => {
  it("has eight screens: seven questions plus contact", () => {
    expect(BRIDGE_STEPS).toHaveLength(8);
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
    expect(assessFit({ liquidCapital: "500k-999k", timeline: "3-6-months" })).toBe("strong");
    expect(assessFit({ liquidCapital: "100k-249k", timeline: "asap" })).toBe("standard");
    expect(assessFit({ liquidCapital: "250k-499k", timeline: "researching" })).toBe("standard");
    expect(assessFit({ liquidCapital: "prefer-private", timeline: "asap" })).toBe("standard");
  });

  it("snapshots every answer with its question and human label", () => {
    const parsed = bridgeAssessmentSchema.parse({ ...valid, notes: "Looking at two brands." });
    const snapshot = answerSnapshot(parsed);
    expect(snapshot.map((a) => a.key)).toEqual([
      "goal",
      "role",
      "timeline",
      "investmentLevel",
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
import { bridgeVideoSummary } from "@/lib/bridge/videoSummary";
import type { PortalEventRecord } from "@/types/analytics";

function event(name: string, data: Record<string, unknown> | null, at: string): PortalEventRecord {
  return {
    id: `${name}-${at}`,
    lead_id: "lead-1",
    event_name: name,
    event_data: data,
    page_url: "/watch",
    event_source: "portal",
    created_by_staff_user_id: null,
    occurred_at: null,
    created_at: at,
  };
}

describe("bridge page for a known lead", () => {
  it("drops the contact step and its fields", () => {
    expect(BRIDGE_STEPS_KNOWN).toHaveLength(7);
    expect(BRIDGE_STEPS_KNOWN.some((s) => s.kind === "contact")).toBe(false);
    const answersOnly = Object.fromEntries(
      Object.entries(valid).filter(([k]) => !["firstName", "lastName", "email", "phone"].includes(k)),
    );
    expect(knownLeadAssessmentSchema.safeParse(answersOnly).success).toBe(true);
    // Contact fields are simply ignored, never required.
    expect(knownLeadAssessmentSchema.safeParse(valid).success).toBe(true);
  });
});

describe("bridge video summary", () => {
  it("is empty without bridge events and ignores overview events", () => {
    const summary = bridgeVideoSummary([event("video_started", null, "2026-09-11T10:00:00Z")]);
    expect(summary.started).toBe(false);
    expect(summary.highestPercent).toBe(0);
  });

  it("reads the high-water mark, last stop, and completion from events", () => {
    const summary = bridgeVideoSummary([
      event("bridge_video_stopped", { percent: 61.4, currentTime: 110, duration: 180 }, "2026-09-11T10:03:00Z"),
      event("bridge_video_progress_25", { percent: 25 }, "2026-09-11T10:01:00Z"),
      event("bridge_video_started", { mediaId: "th7ve390tt" }, "2026-09-11T10:00:00Z"),
      event("bridge_video_progress_50", { percent: 50 }, "2026-09-11T10:02:00Z"),
      event("bridge_video_stopped", { percent: 30, currentTime: 54, duration: 180 }, "2026-09-11T10:01:30Z"),
    ]);
    expect(summary.started).toBe(true);
    expect(summary.highestPercent).toBe(61);
    expect(summary.completed).toBe(false);
    expect(summary.stops).toBe(2);
    expect(summary.stoppedAtSeconds).toBe(110);
    expect(summary.durationSeconds).toBe(180);
    expect(summary.lastEventAt).toBe("2026-09-11T10:03:00Z");

    const done = bridgeVideoSummary([
      event("bridge_video_started", null, "2026-09-11T10:00:00Z"),
      event("bridge_video_completed", { highestPercent: 96 }, "2026-09-11T10:03:00Z"),
    ]);
    expect(done.completed).toBe(true);
    expect(done.highestPercent).toBe(96);
  });
});
