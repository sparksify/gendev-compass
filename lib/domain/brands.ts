import { getStore } from "@/lib/store";
import { getDefaultBrandSlug } from "@/lib/config/env";
import type { BrandRecord, OrganizationRecord } from "@/types/domain";

/**
 * Brand service. The "current portal brand" is resolved by slug
 * (DEFAULT_BRAND_SLUG, default 'default') within the default organization.
 * The placeholder default brand is created on demand and flagged with
 * brand_settings.requires_configuration so an administrator renames it —
 * migrations and code never guess the live brand's real name.
 */

export async function getBrandBySlug(
  organizationId: string,
  slug: string,
): Promise<BrandRecord | null> {
  return getStore().getBrandBySlug(organizationId, slug);
}

export async function resolveDefaultBrand(
  organization: OrganizationRecord,
): Promise<BrandRecord> {
  const store = getStore();
  const slug = getDefaultBrandSlug();
  const existing = await store.getBrandBySlug(organization.id, slug);
  if (existing) return existing;
  try {
    return await store.createBrand({
      organization_id: organization.id,
      name: slug === "default" ? "GenDev Compass Default Brand" : slug,
      slug,
      status: "active",
      brand_settings: { requires_configuration: true },
    });
  } catch {
    const raced = await store.getBrandBySlug(organization.id, slug);
    if (raced) return raced;
    throw new Error(`Failed to resolve default brand '${slug}'`);
  }
}

/** Brand-specific settings with a safe empty default. */
export function getBrandSettings<T extends keyof Pick<
  BrandRecord,
  | "brand_settings"
  | "portal_settings"
  | "qualification_settings"
  | "territory_settings"
  | "integration_settings"
>>(brand: BrandRecord, key: T): Record<string, unknown> {
  return brand[key] ?? {};
}
