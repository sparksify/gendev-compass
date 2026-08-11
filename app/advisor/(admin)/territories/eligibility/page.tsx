import { getStore } from "@/lib/store";
import { Card, CardContent } from "@/components/ui/card";
import { BrandSelector } from "@/components/advisor/territories/BrandSelector";
import { EligibilityGrid } from "@/components/advisor/territories/EligibilityGrid";

export const dynamic = "force-dynamic";

export default async function StateEligibilityPage({
  searchParams,
}: {
  searchParams: Promise<{ brand?: string }>;
}) {
  const { brand: brandSlug } = await searchParams;
  const store = getStore();
  const brands = await store.listBrands();
  const activeBrand = brands.find((b) => b.slug === brandSlug) ?? brands[0] ?? null;
  const rows = activeBrand ? await store.listStateEligibility(activeBrand.id) : [];

  return (
    <div className="space-y-4">
      <BrandSelector brands={brands} activeBrandSlug={activeBrand?.slug} basePath="/advisor/territories/eligibility" />
      {!activeBrand ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">No brands configured yet.</CardContent>
        </Card>
      ) : (
        <EligibilityGrid brandId={activeBrand.id} initialRows={rows} />
      )}
    </div>
  );
}
