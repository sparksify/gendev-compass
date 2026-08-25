import { getStore } from "@/lib/store";
import { ReviewQueue } from "@/components/advisor/territories/ReviewQueue";
import { TerritoryPageShell } from "@/components/advisor/territories/TerritoryPageShell";

export const dynamic = "force-dynamic";

export default async function ReviewRequestsPage() {
  const store = getStore();
  const [reviews, leads, brands, staff, searches] = await Promise.all([
    store.listTerritoryReviewRequests(),
    store.listLeads(),
    store.listBrands(),
    store.listStaffUsers(),
    store.listTerritorySearches(),
  ]);

  const leadById = new Map(leads.map((l) => [l.id, l]));
  const brandById = new Map(brands.map((b) => [b.id, b]));
  const searchById = new Map(searches.map((s) => [s.id, s]));

  const rows = reviews.map((r) => ({
    review: r,
    lead: leadById.get(r.lead_id) ?? null,
    brandName: brandById.get(r.brand_id)?.name ?? "—",
    search: r.territory_search_id ? (searchById.get(r.territory_search_id) ?? null) : null,
  }));

  return (
    <TerritoryPageShell subtitle="Prospect territory requests waiting on a decision">
      <ReviewQueue
        rows={rows}
        staff={staff.filter((s) => s.active).map((s) => ({ id: s.id, name: `${s.first_name} ${s.last_name}` }))}
      />
    </TerritoryPageShell>
  );
}
