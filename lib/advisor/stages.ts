import { getStore } from "@/lib/store";
import { recordLeadEvent } from "@/lib/domain/activities";
import {
  syncPrimaryOpportunityActivity,
  syncPrimaryOpportunityStage,
} from "@/lib/domain/opportunities";
import { INVESTOR_STAGES, STAGE_LABELS, type InvestorStage } from "@/types/advisor";
import type { LeadRecord } from "@/types/lead";

export { STAGE_LABELS };

/**
 * Pipeline order for automatic advancement. Terminal/judgment stages
 * (DUE_DILIGENCE, QUALIFIED, NOT_A_FIT, CLOSED_INVESTED) are only ever set
 * manually by staff; automation never moves an investor into or out of them.
 */
export function stageRank(stage: string): number {
  const index = (INVESTOR_STAGES as readonly string[]).indexOf(stage);
  return index === -1 ? 0 : index;
}

export function isInvestorStage(value: string): value is InvestorStage {
  return (INVESTOR_STAGES as readonly string[]).includes(value);
}

const MANUAL_ONLY_STAGES: InvestorStage[] = [
  "DUE_DILIGENCE",
  "QUALIFIED",
  "NOT_A_FIT",
  "CLOSED_INVESTED",
];

/**
 * Automatic, forward-only stage advancement triggered by portal/webhook
 * events. Never moves an investor backward and never touches an investor a
 * staff member has placed in a manual judgment stage. Records the change
 * as a stage_changed event.
 */
export async function autoAdvanceStage(
  lead: LeadRecord,
  target: InvestorStage,
  source: string,
): Promise<void> {
  const current = lead.current_stage;
  if (MANUAL_ONLY_STAGES.includes(current as InvestorStage)) return;
  if (stageRank(target) <= stageRank(current)) return;

  const store = getStore();
  const updated = await store.updateLead(lead.id, { current_stage: target });
  await syncPrimaryOpportunityStage(updated, target);
  await recordLeadEvent(
    updated,
    "stage_changed",
    { oldStage: current, newStage: target, automatic: true },
    null,
    { source },
  );
  lead.current_stage = target;
}

/**
 * Manual stage change by a staff member — any direction is allowed.
 * Records the change with the acting staff user for the audit trail.
 */
export async function setStageManually(
  lead: LeadRecord,
  target: InvestorStage,
  staffUserId: string,
): Promise<void> {
  if (lead.current_stage === target) return;
  const store = getStore();
  const updated = await store.updateLead(lead.id, { current_stage: target });
  await syncPrimaryOpportunityStage(updated, target);
  await recordLeadEvent(
    updated,
    "stage_changed",
    { oldStage: lead.current_stage, newStage: target, automatic: false },
    null,
    { source: "staff", staffUserId },
  );
}

/** Stamps last_activity_at; call whenever the investor does something. */
export async function touchActivity(leadId: string, at: string = new Date().toISOString()): Promise<void> {
  const updated = await getStore().updateLead(leadId, { last_activity_at: at });
  await syncPrimaryOpportunityActivity(updated, at);
}
