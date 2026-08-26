import { getStore } from "@/lib/store";
import { countPendingTerritoryReviews } from "@/lib/advisor/territoryAdmin";
import {
  EligibilityScreen,
  type RecentSearch,
} from "@/components/advisor/territories/EligibilityScreen";
import { TERRITORY_RESULT_STATUSES, type TerritoryResultStatus } from "@/types/territory";

export const dynamic = "force-dynamic";

const WEEK_MS = 7 * 24 * 3_600_000;

export default async function StateEligibilityPage({
  searchParams,
}: {
  searchParams: Promise<{ brand?: string }>;
}) {
  const { brand: brandSlug } = await searchParams;
  const store = getStore();
  const [brands, leads, searches, pendingReviews] = await Promise.all([
    store.listBrands(),
    store.listLeads(),
    store.listTerritorySearches(),
    countPendingTerritoryReviews(),
  ]);

  const activeBrand = brands.find((b) => b.slug === brandSlug) ?? brands[0] ?? null;
  const rows = activeBrand ? await store.listStateEligibility(activeBrand.id) : [];

  const leadById = new Map(leads.map((lead) => [lead.id, lead]));
  const cutoff = Date.now() - WEEK_MS;
  const week = searches.filter(
    (search) =>
      (!activeBrand || search.brand_id === activeBrand.id) &&
      new Date(search.created_at).getTime() >= cutoff,
  );

  const recentSearches: RecentSearch[] = [...week]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 6)
    .map((search) => {
      const lead = leadById.get(search.lead_id);
      return {
        id: search.id,
        market: search.normalized_location ?? search.raw_query,
        prospect: lead ? `${lead.first_name} ${lead.last_name}` : null,
        status: search.result_status,
      };
    });

  const outcomes = TERRITORY_RESULT_STATUSES.map((status: TerritoryResultStatus) => ({
    status,
    count: week.filter((search) => search.result_status === status).length,
  })).filter((entry) => entry.count > 0);

  return (
    <EligibilityScreen
      brandId={activeBrand?.id ?? null}
      brandName={activeBrand?.name ?? null}
      initialRows={rows}
      recentSearches={recentSearches}
      searchTotal={week.length}
      outcomes={outcomes}
      pendingReviews={pendingReviews}
    />
  );
}
