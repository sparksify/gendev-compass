import { describe, expect, it } from "vitest";
import { filterInvestorRows, type InvestorRow } from "@/lib/advisor/investors";
import { hoursAgo, makeAppointment, makeLead } from "./helpers";
import type { LeadRecord } from "@/types/lead";

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
    ...extra,
  };
}

describe("investor search and filtering", () => {
  const maria = makeRow(
    makeLead({
      first_name: "Maria",
      last_name: "Chen",
      email: "maria@example.test",
      phone: "+15551234567",
      state: "Texas",
      current_stage: "QUESTIONNAIRE_COMPLETED",
      questionnaire_completed_at: hoursAgo(5),
      assigned_advisor_id: "advisor-1",
    }),
  );
  const james = makeRow(
    makeLead({
      first_name: "James",
      last_name: "Okafor",
      email: "james@example.test",
      phone: "+15559876543",
      state: "Florida",
      current_stage: "CONSULTATION_SCHEDULED",
      assigned_advisor_id: "advisor-2",
      last_activity_at: hoursAgo(100),
    }),
    { appointments: [makeAppointment({ status: "SCHEDULED" })] },
  );
  const rows = [maria, james];

  it("searches by name (case-insensitive)", () => {
    expect(filterInvestorRows(rows, { search: "maria" })).toEqual([maria]);
    expect(filterInvestorRows(rows, { search: "OKAFOR" })).toEqual([james]);
  });

  it("searches by email and phone digits", () => {
    expect(filterInvestorRows(rows, { search: "james@example" })).toEqual([james]);
    expect(filterInvestorRows(rows, { search: "555123" })).toEqual([maria]);
  });

  it("filters by stage, advisor, and state", () => {
    expect(filterInvestorRows(rows, { stage: "CONSULTATION_SCHEDULED" })).toEqual([james]);
    expect(filterInvestorRows(rows, { advisorId: "advisor-1" })).toEqual([maria]);
    expect(filterInvestorRows(rows, { state: "texas" })).toEqual([maria]);
  });

  it("filters by consultation status", () => {
    expect(filterInvestorRows(rows, { consultation: "scheduled" })).toEqual([james]);
    expect(filterInvestorRows(rows, { consultation: "none" })).toEqual([maria]);
  });

  it("filters by FDD status", () => {
    const withFdd = makeRow(makeLead({ fdd_status: "fdd_sent" }), { fddStatus: "fdd_sent" });
    expect(filterInvestorRows([...rows, withFdd], { fdd: "sent" })).toEqual([withFdd]);
    expect(filterInvestorRows([maria, withFdd], { fdd: "none" })).toEqual([maria]);
  });

  it("filters by questionnaire completion", () => {
    expect(filterInvestorRows(rows, { questionnaire: "completed" })).toEqual([maria]);
    expect(filterInvestorRows(rows, { questionnaire: "incomplete" })).toEqual([james]);
  });

  it("filters by recent activity", () => {
    expect(filterInvestorRows(rows, { activeWithinHours: 24 })).toEqual([maria]);
  });

  it("filters to follow-up-needed rows", () => {
    const flagged = makeRow(makeLead(), { followUp: { needed: true, reasons: ["r"] } });
    expect(filterInvestorRows([...rows, flagged], { followUpOnly: true })).toEqual([flagged]);
  });

  it("combines filters", () => {
    expect(
      filterInvestorRows(rows, { search: "chen", stage: "QUESTIONNAIRE_COMPLETED", state: "Texas" }),
    ).toEqual([maria]);
    expect(filterInvestorRows(rows, { search: "chen", stage: "CONSULTATION_SCHEDULED" })).toEqual([]);
  });
});
