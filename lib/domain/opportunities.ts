import { getStore } from "@/lib/store";
import { recordLeadEvent } from "@/lib/domain/activities";
import type { LeadRecord } from "@/types/lead";
import type { InvestorStage } from "@/types/advisor";
import type {
  CreateOpportunityInput,
  OpportunityRecord,
  OrganizationMembershipRecord,
} from "@/types/domain";

/**
 * Opportunity service — the central write path for brand-specific pipeline
 * state.
 *
 * Dual-write direction (no loops): stage/assignment/activity changes made
 * through the legacy lead-centric flows (lib/advisor/stages.ts, the assign
 * route) call the sync helpers here to project the change onto the lead's
 * PRIMARY opportunity. Writes never flow from the opportunity back onto the
 * lead except through these same explicit helpers — there are no triggers.
 * Non-primary opportunities (a client's second brand journey) are updated
 * only through the opportunity-first functions and never touch the lead.
 */

export async function getOpportunityById(id: string): Promise<OpportunityRecord | null> {
  return getStore().getOpportunityById(id);
}

export async function listOpportunitiesForClient(
  clientId: string,
): Promise<OpportunityRecord[]> {
  return getStore().listOpportunitiesForClient(clientId);
}

/** The lead's primary opportunity, or null when the chain has not been built. */
export async function resolvePrimaryOpportunity(
  lead: LeadRecord,
): Promise<OpportunityRecord | null> {
  const store = getStore();
  if (lead.primary_opportunity_id) {
    const byId = await store.getOpportunityById(lead.primary_opportunity_id);
    if (byId) return byId;
  }
  return store.getOpportunityBySourceLeadId(lead.id);
}

/**
 * Creates an additional opportunity for an existing client (e.g. a second
 * brand journey). Never touches any lead.
 */
export async function createOpportunityForClient(
  input: CreateOpportunityInput,
): Promise<OpportunityRecord> {
  return getStore().createOpportunity(input);
}

/**
 * Projects a lead-side stage change onto the lead's primary opportunity.
 * Called by lib/advisor/stages.ts after it updates the lead — the lead
 * remains the legacy read model, the opportunity the target one.
 */
export async function syncPrimaryOpportunityStage(
  lead: LeadRecord,
  stage: InvestorStage,
  lastActivityAt: string | null = null,
): Promise<void> {
  const opportunity = await resolvePrimaryOpportunity(lead);
  if (!opportunity) return;
  if (opportunity.stage === stage && !lastActivityAt) return;
  await getStore().updateOpportunity(opportunity.id, {
    stage,
    ...(lastActivityAt ? { last_activity_at: lastActivityAt } : {}),
  });
}

/** Projects lead-side qualification results onto the primary opportunity. */
export async function syncPrimaryOpportunityQualification(lead: LeadRecord): Promise<void> {
  const opportunity = await resolvePrimaryOpportunity(lead);
  if (!opportunity) return;
  await getStore().updateOpportunity(opportunity.id, {
    qualification_score: lead.qualification_score,
    qualification_result: lead.qualification_result,
    qualification_reasons: lead.qualification_reasons,
  });
}

/** Projects lead-side activity timestamps onto the primary opportunity. */
export async function syncPrimaryOpportunityActivity(
  lead: LeadRecord,
  at: string,
): Promise<void> {
  const opportunity = await resolvePrimaryOpportunity(lead);
  if (!opportunity) return;
  await getStore().updateOpportunity(opportunity.id, { last_activity_at: at });
}

/**
 * Assigns an advisor (profile + membership) to an opportunity, recording the
 * assignment row. When the opportunity is a lead's primary opportunity the
 * caller is responsible for also updating leads.assigned_advisor_id (the
 * legacy mirror) — see the advisor assign route.
 */
export async function assignAdvisorToOpportunity(
  opportunity: OpportunityRecord,
  membership: OrganizationMembershipRecord | null,
): Promise<OpportunityRecord> {
  const store = getStore();
  const updated = await store.updateOpportunity(opportunity.id, {
    assigned_advisor_profile_id: membership ? membership.profile_id : null,
    assigned_advisor_membership_id: membership ? membership.id : null,
  });
  if (membership) {
    const assignments = await store.listAssignmentsForOpportunity(opportunity.id);
    const active = assignments.find(
      (a) =>
        a.membership_id === membership.id &&
        a.assignment_role === "PRIMARY_ADVISOR" &&
        a.unassigned_at === null,
    );
    if (!active) {
      await store.createOpportunityAssignment({
        opportunity_id: opportunity.id,
        membership_id: membership.id,
        assignment_role: "PRIMARY_ADVISOR",
        is_primary: true,
      });
    }
  }
  return updated;
}

/** Closes an opportunity. Never touches the client's other opportunities. */
export async function closeOpportunity(
  opportunity: OpportunityRecord,
  outcome: "won" | "lost" | "archived",
  reason: string | null = null,
): Promise<OpportunityRecord> {
  return getStore().updateOpportunity(opportunity.id, {
    status: outcome,
    closed_at: new Date().toISOString(),
    closed_reason: reason,
    outcome,
  });
}

export async function reopenOpportunity(
  opportunity: OpportunityRecord,
): Promise<OpportunityRecord> {
  return getStore().updateOpportunity(opportunity.id, {
    status: "open",
    closed_at: null,
    closed_reason: null,
    outcome: null,
  });
}

/** Convenience: record an event against a lead's primary opportunity. */
export { recordLeadEvent };
