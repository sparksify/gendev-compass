import { describe, expect, it } from "vitest";
import { canAccessLead, visibleLeads } from "@/lib/advisor/access";
import { makeLead } from "./helpers";

const admin = { id: "admin-1", role: "ADMIN" as const };
const advisor = { id: "advisor-1", role: "ADVISOR" as const };

describe("role-based access", () => {
  it("admin sees every investor", () => {
    const lead = makeLead({ assigned_advisor_id: "someone-else" });
    expect(canAccessLead(admin, lead, false)).toBe(true);
  });

  it("advisor sees assigned investors when restricted", () => {
    expect(canAccessLead(advisor, makeLead({ assigned_advisor_id: "advisor-1" }), false)).toBe(true);
    expect(canAccessLead(advisor, makeLead({ assigned_advisor_id: "advisor-2" }), false)).toBe(false);
    expect(canAccessLead(advisor, makeLead({ assigned_advisor_id: null }), false)).toBe(false);
  });

  it("advisor sees all investors in pilot (sees-all) mode", () => {
    expect(canAccessLead(advisor, makeLead({ assigned_advisor_id: "advisor-2" }), true)).toBe(true);
  });

  it("visibleLeads filters to assignments when restricted", () => {
    const mine = makeLead({ assigned_advisor_id: "advisor-1" });
    const other = makeLead({ assigned_advisor_id: "advisor-2" });
    expect(visibleLeads(advisor, [mine, other], false)).toEqual([mine]);
    expect(visibleLeads(admin, [mine, other], false)).toEqual([mine, other]);
  });
});
