import { describe, expect, it } from "vitest";
import { canAccessLead, leadInScope, visibleLeads } from "@/lib/advisor/access";
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

describe("brand lead scope", () => {
  const sparksLead = makeLead({ source: "facebook-sparks" });
  const gendevLead = makeLead({ source: "facebook-gendev" });
  const legacyLead = makeLead({ source: "facebook" });

  it("all-scope users see every source", () => {
    const steve = { id: "steve", role: "ADMIN" as const, lead_scope: "all" as const };
    expect(leadInScope(steve, sparksLead)).toBe(true);
    expect(canAccessLead(steve, sparksLead, true)).toBe(true);
  });

  it("gendev-scope users never see Sparks leads, even as admins", () => {
    const darko = { id: "darko", role: "ADMIN" as const, lead_scope: "gendev" as const };
    expect(canAccessLead(darko, sparksLead, true)).toBe(false);
    expect(canAccessLead(darko, gendevLead, true)).toBe(true);
    // Untagged legacy leads remain visible working inventory.
    expect(canAccessLead(darko, legacyLead, true)).toBe(true);
  });

  it("visibleLeads strips out-of-scope leads before role filtering", () => {
    const darko = { id: "darko", role: "ADMIN" as const, lead_scope: "gendev" as const };
    expect(visibleLeads(darko, [sparksLead, gendevLead, legacyLead], true)).toEqual([
      gendevLead,
      legacyLead,
    ]);
  });

  it("users without a stored scope default to full visibility", () => {
    const legacyUser = { id: "u1", role: "ADVISOR" as const };
    expect(leadInScope(legacyUser, sparksLead)).toBe(true);
  });
});
