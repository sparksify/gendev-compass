import { getStore } from "@/lib/store";
import type {
  CreateTerritoryRequestInput,
  TerritoryRequestPatch,
  TerritoryRequestRecord,
} from "@/types/domain";

/**
 * Territory request service — FOUNDATION ONLY.
 *
 * This phase deliberately ships the data model, typed interfaces, and
 * plumbing without any availability intelligence: every submitted request
 * lands in 'pending' for manual processing. Automated availability lookups
 * and registration-state checks are future work that plugs into
 * updateTerritoryResult without schema changes.
 *
 * Territory checks are brand/opportunity-specific by construction — the
 * required opportunity_id and brand_id keep results from ever being
 * attached to a client globally.
 */

export async function submitTerritoryRequest(
  input: CreateTerritoryRequestInput,
): Promise<TerritoryRequestRecord> {
  return getStore().createTerritoryRequest(input);
}

export async function getTerritoryRequest(
  id: string,
): Promise<TerritoryRequestRecord | null> {
  return getStore().getTerritoryRequestById(id);
}

export async function listTerritoryRequestsForOpportunity(
  opportunityId: string,
): Promise<TerritoryRequestRecord[]> {
  return getStore().listTerritoryRequestsForOpportunity(opportunityId);
}

export async function updateTerritoryResult(
  id: string,
  patch: TerritoryRequestPatch,
): Promise<TerritoryRequestRecord> {
  return getStore().updateTerritoryRequest(id, patch);
}
