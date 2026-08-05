import { getStore } from "@/lib/store";
import type { LeadRecord } from "@/types/lead";
import type { OpportunityFddWorkflowRecord } from "@/types/domain";
import type { LeadDomainChain } from "@/lib/domain/chain";

/**
 * Opportunity-level FDD workflow synchronization.
 *
 * Canonical write path and direction (no loops): the FDD engine in
 * lib/fdd/workflow.ts updates the lead's legacy fdd_* mirror first (that is
 * what every current screen reads), then calls syncFddWorkflowFromLead to
 * project the same state onto the opportunity-level workflow row. Nothing
 * ever writes lead fdd_* FROM the workflow row, so the two can never chase
 * each other.
 *
 * Scoping: one workflow row per opportunity (unique in the schema). A client
 * with two brand opportunities has two independent workflows — idempotency
 * keys are opportunity-scoped (see lib/fdd/workflow.ts).
 */

export async function getFddWorkflowForOpportunity(
  opportunityId: string,
): Promise<OpportunityFddWorkflowRecord | null> {
  return getStore().getFddWorkflowByOpportunityId(opportunityId);
}

/**
 * Projects the lead's fdd_* fields onto the opportunity FDD workflow,
 * creating the row on first use. Safe to call repeatedly.
 */
export async function syncFddWorkflowFromLead(
  chain: Pick<LeadDomainChain, "lead" | "organization" | "brand" | "client" | "opportunity">,
): Promise<OpportunityFddWorkflowRecord | null> {
  const store = getStore();
  const { lead, organization, brand, client, opportunity } = chain;

  let workflow = await store.getFddWorkflowByOpportunityId(opportunity.id);
  if (!workflow) {
    if (lead.fdd_status === "not_requested") return null;
    try {
      workflow = await store.createFddWorkflow({
        organization_id: organization.id,
        client_id: client.id,
        opportunity_id: opportunity.id,
        brand_id: brand.id,
      });
    } catch {
      workflow = await store.getFddWorkflowByOpportunityId(opportunity.id);
      if (!workflow) {
        console.error(`[fdd] failed to create workflow for opportunity ${opportunity.id}`);
        return null;
      }
    }
  }

  const patch = buildWorkflowPatch(lead, workflow);
  if (Object.keys(patch).length === 0) return workflow;
  return store.updateFddWorkflow(workflow.id, patch);
}

function buildWorkflowPatch(
  lead: LeadRecord,
  workflow: OpportunityFddWorkflowRecord,
): Partial<OpportunityFddWorkflowRecord> {
  const desired = {
    status: lead.fdd_status,
    requested_at: lead.fdd_requested_at,
    sent_at: lead.fdd_sent_at,
    delivered_at: lead.fdd_delivered_at,
    received_at: lead.fdd_received_at,
    eligible_at: lead.fdd_eligible_at,
    provider:
      workflow.provider ??
      (lead.fdd_provider_envelope_id || lead.fdd_workflow_id ? "gohighlevel" : null),
    provider_envelope_id: lead.fdd_provider_envelope_id,
    external_workflow_id: lead.fdd_workflow_id,
    request_source: lead.fdd_request_source,
    last_error: lead.fdd_last_error,
    retry_count: lead.fdd_retry_count,
  } as const;

  const patch: Partial<OpportunityFddWorkflowRecord> = {};
  for (const key of Object.keys(desired) as Array<keyof typeof desired>) {
    if (workflow[key] !== desired[key]) {
      (patch as Record<string, unknown>)[key] = desired[key];
    }
  }
  return patch;
}
