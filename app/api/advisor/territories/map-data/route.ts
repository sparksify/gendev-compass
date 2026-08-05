import { NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/advisor/auth";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

/**
 * Everything the advisor territory map needs for one brand: territory
 * definitions (with exact boundaries — staff only), their ZIP geometries,
 * and state eligibility. Prospects never see this endpoint; it sits behind
 * the staff session like every other advisor API.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const auth = await requireStaffApi();
  if ("response" in auth) return auth.response;

  const store = getStore();
  const url = new URL(request.url);
  const brandSlug = url.searchParams.get("brand");

  const brands = await store.listBrands();
  const brand = brandSlug ? brands.find((b) => b.slug === brandSlug) : brands[0];
  if (!brand) {
    return NextResponse.json({ success: false, error: "No brand configured" }, { status: 404 });
  }

  const [definitions, eligibility] = await Promise.all([
    store.listTerritoryDefinitions(brand.id),
    store.listStateEligibility(brand.id),
  ]);

  const territories = await Promise.all(
    definitions.map(async (definition) => {
      const zips =
        definition.definition_type === "zip_list"
          ? (await store.listZipCodesForTerritory(definition.id)).map((z) => z.zip_code)
          : [];
      return {
        id: definition.id,
        name: definition.territory_name,
        code: definition.territory_code,
        type: definition.definition_type,
        status: definition.status,
        center:
          definition.center_latitude != null && definition.center_longitude != null
            ? { latitude: definition.center_latitude, longitude: definition.center_longitude }
            : null,
        radiusMiles: definition.radius_miles,
        zips,
      };
    }),
  );

  const allZips = [...new Set(territories.flatMap((t) => t.zips))];
  const geographies = await store.listZipGeographies(allZips);

  return NextResponse.json({
    success: true,
    brand: { id: brand.id, name: brand.name, slug: brand.slug },
    brands: brands.map((b) => ({ id: b.id, name: b.name, slug: b.slug })),
    territories,
    eligibility: eligibility.map((e) => ({ state: e.state_code, status: e.status })),
    zipGeometry: {
      type: "FeatureCollection",
      features: geographies.map((g) => ({
        type: "Feature",
        properties: { zip: g.zip_code },
        geometry: g.geojson,
      })),
    },
  });
}
