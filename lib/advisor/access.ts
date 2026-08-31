import type { LeadScope, StaffUserRecord } from "@/types/advisor";
import type { LeadRecord } from "@/types/lead";

/**
 * Lead sources owned exclusively by the Sparks side of the business.
 * Staff scoped to 'gendev' never see leads carrying these sources —
 * anywhere: lists, detail pages, dashboard, export. Untagged/legacy leads
 * (e.g. plain "facebook") are treated as GenDev-side working inventory.
 */
export const SPARKS_ONLY_SOURCES: readonly string[] = ["facebook-sparks"];

type ScopedUser = Pick<StaffUserRecord, "id" | "role"> & { lead_scope?: LeadScope };

/** Whether the user's brand scope permits seeing this lead at all. */
export function leadInScope(
  user: Pick<ScopedUser, "lead_scope">,
  lead: Pick<LeadRecord, "source">,
): boolean {
  if ((user.lead_scope ?? "all") === "all") return true;
  return !SPARKS_ONLY_SOURCES.includes(lead.source ?? "");
}

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
  user: ScopedUser,
  lead: Pick<LeadRecord, "assigned_advisor_id" | "source">,
  seesAll: boolean = advisorSeesAll(),
): boolean {
  // Brand scope is absolute — it applies to admins and advisors alike.
  if (!leadInScope(user, lead)) return false;
  if (user.role === "ADMIN") return true;
  if (seesAll) return true;
  return lead.assigned_advisor_id === user.id;
}

/** Leads the given staff user is allowed to see. */
export function visibleLeads<T extends Pick<LeadRecord, "assigned_advisor_id" | "source">>(
  user: ScopedUser,
  leads: T[],
  seesAll: boolean = advisorSeesAll(),
): T[] {
  const inScope = leads.filter((lead) => leadInScope(user, lead));
  if (user.role === "ADMIN" || seesAll) return inScope;
  return inScope.filter((lead) => lead.assigned_advisor_id === user.id);
}

export function isAdmin(user: Pick<StaffUserRecord, "role">): boolean {
  return user.role === "ADMIN";
}
