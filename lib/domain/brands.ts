import { getStore } from "@/lib/store";
import { getDefaultBrandSlug } from "@/lib/config/env";
import type { BrandRecord, OrganizationRecord } from "@/types/domain";

/**
 * Brand service. The Territory Advisor's `franchise_brands` table IS the
 * platform brand entity — opportunities, FDD workflows, and territory data
 * all key off it, and there is deliberately no second brand table.
 *
 * Brand slugs are globally unique (the territory feature's convention,
 * matched by the live schema); `organization_id` scopes ownership and is
 * backfilled to the default organization by the platform migrations.
 *
 * The "current portal brand" is resolved by slug (DEFAULT_BRAND_SLUG,
 * default 'cmdt' — the live CMDT brand seeded by the territory migration)
 * and created on demand in environments where it does not exist yet.
 */

export async function getBrandBySlug(slug: string): Promise<BrandRecord | null> {
  return getStore().getBrandBySlug(slug);
}

export async function resolveDefaultBrand(
  organization: OrganizationRecord,
): Promise<BrandRecord> {
  const store = getStore();
  const slug = getDefaultBrandSlug();
  const existing = await store.getBrandBySlug(slug);
  if (existing) return existing;
  try {
    return await store.createBrand({
      slug,
      name: slug === "cmdt" ? "Complete Mobile Drug Testing" : slug,
      organization_id: organization.id,
    });
  } catch {
    const raced = await store.getBrandBySlug(slug);
    if (raced) return raced;
    throw new Error(`Failed to resolve default brand '${slug}'`);
  }
}
