import { getStore } from "@/lib/store";
import type {
  TerritoryReviewRequestRecord,
  TerritorySearchRecord,
} from "@/types/territory";

/**
 * Opportunity-aware access to the Territory Advisor's data
 * (territory_searches / territory_review_requests). The Territory Advisor
 * feature owns evaluation (lib/territory/), admin screens, and the portal
 * chat; this service adds the platform view: territory activity scoped to a
 * specific opportunity, so a client with two brand opportunities keeps two
 * independent territory histories.
 *
 * Rows carry nullable organization/client/opportunity links (backfilled by
 * the platform migrations; populated at creation by the portal routes).
 * Lead-scoped listings fall back to legacy rows whose links are null.
 */

export async function listTerritorySearchesForOpportunity(
  opportunityId: string,
): Promise<TerritorySearchRecord[]> {
  const all = await getStore().listTerritorySearches();
  return all.filter((s) => s.opportunity_id === opportunityId);
}

export async function listTerritoryReviewRequestsForOpportunity(
  opportunityId: string,
): Promise<TerritoryReviewRequestRecord[]> {
  const all = await getStore().listTerritoryReviewRequests();
  return all.filter((r) => r.opportunity_id === opportunityId);
}

export async function listClientTerritoryActivity(clientId: string): Promise<{
  searches: TerritorySearchRecord[];
  reviewRequests: TerritoryReviewRequestRecord[];
}> {
  const store = getStore();
  const [searches, reviewRequests] = await Promise.all([
    store.listTerritorySearches(),
    store.listTerritoryReviewRequests(),
  ]);
  return {
    searches: searches.filter((s) => s.client_id === clientId),
    reviewRequests: reviewRequests.filter((r) => r.client_id === clientId),
  };
}
