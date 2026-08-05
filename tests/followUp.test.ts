import { describe, expect, it } from "vitest";
import { evaluateFollowUp } from "@/lib/advisor/followUp";
import { hoursAgo, makeAppointment, makeFdd, makeLead, makeVideo } from "./helpers";

describe("follow-up rules", () => {
  it("flags questionnaire completed >24h ago with no consultation", () => {
    const result = evaluateFollowUp({
      lead: makeLead({ questionnaire_completed_at: hoursAgo(30) }),
      appointments: [],
      fdd: null,
      video: null,
    });
    expect(result.needed).toBe(true);
    expect(result.reasons[0]).toMatch(/Questionnaire completed .* no consultation booked/);
  });

  it("does not flag a fresh questionnaire", () => {
    const result = evaluateFollowUp({
      lead: makeLead({ questionnaire_completed_at: hoursAgo(2) }),
      appointments: [],
      fdd: null,
      video: null,
    });
    expect(result.needed).toBe(false);
  });

  it("does not flag when a consultation is booked", () => {
    const result = evaluateFollowUp({
      lead: makeLead({ questionnaire_completed_at: hoursAgo(48) }),
      appointments: [makeAppointment({ status: "SCHEDULED" })],
      fdd: null,
      video: null,
    });
    expect(result.needed).toBe(false);
  });

  it("flags FDD sent >48h without acknowledgment", () => {
    const result = evaluateFollowUp({
      lead: makeLead(),
      appointments: [],
      fdd: makeFdd({ status: "SENT", sent_at: hoursAgo(72) }),
      video: null,
    });
    expect(result.needed).toBe(true);
    expect(result.reasons[0]).toMatch(/FDD sent .* not acknowledged/);
  });

  it("does not flag an acknowledged FDD", () => {
    const result = evaluateFollowUp({
      lead: makeLead(),
      appointments: [],
      fdd: makeFdd({ status: "ACKNOWLEDGED", sent_at: hoursAgo(100), acknowledged_at: hoursAgo(10) }),
      video: null,
    });
    expect(result.needed).toBe(false);
  });

  it("flags stalled consultation-completed stage", () => {
    const result = evaluateFollowUp({
      lead: makeLead({ current_stage: "CONSULTATION_COMPLETED" }),
      appointments: [makeAppointment({ status: "COMPLETED", updated_at: hoursAgo(30) })],
      fdd: null,
      video: null,
    });
    expect(result.needed).toBe(true);
  });

  it("flags high video engagement without questionnaire after 48h", () => {
    const result = evaluateFollowUp({
      lead: makeLead(),
      appointments: [],
      fdd: null,
      video: makeVideo({ highest_percent_watched: 80, last_event_at: hoursAgo(72) }),
    });
    expect(result.needed).toBe(true);
    expect(result.reasons[0]).toMatch(/questionnaire not completed/i);
  });

  it("flags cancelled and never rescheduled appointments", () => {
    const result = evaluateFollowUp({
      lead: makeLead(),
      appointments: [makeAppointment({ status: "CANCELLED", updated_at: hoursAgo(5) })],
      fdd: null,
      video: null,
    });
    expect(result.needed).toBe(true);
    expect(result.reasons[0]).toMatch(/not rescheduled/);
  });

  it("does not flag a cancellation that was rebooked", () => {
    const result = evaluateFollowUp({
      lead: makeLead(),
      appointments: [
        makeAppointment({ status: "CANCELLED", updated_at: hoursAgo(5) }),
        makeAppointment({ status: "SCHEDULED" }),
      ],
      fdd: null,
      video: null,
    });
    expect(result.needed).toBe(false);
  });
});
