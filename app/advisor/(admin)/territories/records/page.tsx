import { getStore } from "@/lib/store";
import {
  TerritoryRecordsScreen,
  type BrandChip,
} from "@/components/advisor/territories/TerritoryRecordsScreen";
import type { ReviewRow } from "@/components/advisor/territories/ReviewQueue";

export const dynamic = "force-dynamic";

export default async function TerritoryRecordsPage({
  searchParams,
}: {
  searchParams: Promise<{ brand?: string }>;
}) {
  const { brand: brandSlug } = await searchParams;
  const store = getStore();
  const [brands, reviews, leads, staff, searches] = await Promise.all([
    store.listBrands(),
    store.listTerritoryReviewRequests(),
    store.listLeads(),
    store.listStaffUsers(),
    store.listTerritorySearches(),
  ]);

  const active = brands.find((b) => b.slug === brandSlug) ?? brands[0] ?? null;

  // Territory counts for every brand chip; ZIP counts only for the active
  // brand's rows (the only ones the table renders).
  const territoriesByBrand = new Map(
    await Promise.all(
      brands.map(
        async (brand) =>
          [brand.id, await store.listTerritoryDefinitions(brand.id)] as const,
      ),
    ),
  );
  const territories = active ? (territoriesByBrand.get(active.id) ?? []) : [];
  const zipCounts: Record<string, number> = {};
  for (const territory of territories) {
    zipCounts[territory.id] = (await store.listZipCodesForTerritory(territory.id)).length;
  }

  const leadById = new Map(leads.map((l) => [l.id, l]));
  const brandById = new Map(brands.map((b) => [b.id, b]));
  const searchById = new Map(searches.map((s) => [s.id, s]));
  const reviewRows: ReviewRow[] = reviews
    .filter((review) => review.status === "new" || review.status === "in_review")
    .map((review) => ({
      review,
      lead: leadById.get(review.lead_id) ?? null,
      brandName: brandById.get(review.brand_id)?.name ?? "—",
      search: review.territory_search_id
        ? (searchById.get(review.territory_search_id) ?? null)
        : null,
    }));

  const chips: BrandChip[] = brands.map((brand) => ({
    id: brand.id,
    slug: brand.slug,
    name: brand.name,
    territoryCount: (territoriesByBrand.get(brand.id) ?? []).length,
  }));

  return (
    <TerritoryRecordsScreen
      brands={chips}
      activeBrand={chips.find((chip) => chip.id === active?.id) ?? null}
      territories={territories}
      zipCounts={zipCounts}
      reviewRows={reviewRows}
      staff={staff
        .filter((s) => s.active)
        .map((s) => ({ id: s.id, name: `${s.first_name} ${s.last_name}` }))}
      pendingReviews={reviewRows.length}
    />
  );
}
