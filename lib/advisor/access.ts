import type { StaffUserRecord } from "@/types/advisor";
import type { LeadRecord } from "@/types/lead";

/**
 * Role-based access rules, enforced server-side on every page and API.
 *
 * Pilot behavior: with one primary advisor (Darko) the default is that
 * advisors see all investors. Set ADVISOR_SEES_ALL=false to restrict
 * advisors to their assigned investors when more advisors join.
 */
export function advisorSeesAll(): boolean {
  return process.env.ADVISOR_SEES_ALL !== "false";
}

export function canAccessLead(
  user: Pick<StaffUserRecord, "id" | "role">,
  lead: Pick<LeadRecord, "assigned_advisor_id">,
  seesAll: boolean = advisorSeesAll(),
): boolean {
  if (user.role === "ADMIN") return true;
  if (seesAll) return true;
  return lead.assigned_advisor_id === user.id;
}

/** Leads the given staff user is allowed to see. */
export function visibleLeads<T extends Pick<LeadRecord, "assigned_advisor_id">>(
  user: Pick<StaffUserRecord, "id" | "role">,
  leads: T[],
  seesAll: boolean = advisorSeesAll(),
): T[] {
  if (user.role === "ADMIN" || seesAll) return leads;
  return leads.filter((lead) => lead.assigned_advisor_id === user.id);
}

export function isAdmin(user: Pick<StaffUserRecord, "role">): boolean {
  return user.role === "ADMIN";
}
