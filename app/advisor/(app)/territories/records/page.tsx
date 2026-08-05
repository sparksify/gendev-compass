import { getStore } from "@/lib/store";
import { Card, CardContent } from "@/components/ui/card";
import { BrandSelector } from "@/components/advisor/territories/BrandSelector";
import { TerritoryRecordsPanel } from "@/components/advisor/territories/TerritoryRecordsPanel";

export const dynamic = "force-dynamic";

export default async function TerritoryRecordsPage({
  searchParams,
}: {
  searchParams: Promise<{ brand?: string }>;
}) {
  const { brand: brandSlug } = await searchParams;
  const store = getStore();
  const brands = await store.listBrands();
  const activeBrand = brands.find((b) => b.slug === brandSlug) ?? brands[0] ?? null;

  const territories = activeBrand ? await store.listTerritoryDefinitions(activeBrand.id) : [];
  const zipCounts = new Map<string, number>();
  for (const territory of territories) {
    const zips = await store.listZipCodesForTerritory(territory.id);
    zipCounts.set(territory.id, zips.length);
  }

  return (
    <div className="space-y-4">
      <BrandSelector brands={brands} activeBrandSlug={activeBrand?.slug} basePath="/advisor/territories/records" />

      {!activeBrand ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            No brands configured yet. Run <code className="rounded bg-surface px-1 py-0.5">npm run seed:territory</code> or
            create one via the API to get started.
          </CardContent>
        </Card>
      ) : (
        <TerritoryRecordsPanel brandId={activeBrand.id} initialTerritories={territories} initialZipCounts={Object.fromEntries(zipCounts)} />
      )}
    </div>
  );
}
