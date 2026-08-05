import { getStore } from "@/lib/store";
import { getOpportunityProfile } from "@/lib/config/opportunity";
import type { FranchiseBrandRecord } from "@/types/territory";

/**
 * Resolves the franchise_brands row for the opportunity currently shown in
 * the portal. Today there is exactly one opportunity (CMDT, config-driven —
 * see lib/config/opportunity.ts); its `slug` is the bridge to the DB-backed
 * brand row so territory data has something to key off. When a second brand
 * ships, this is the one place that needs to learn how to pick the right
 * opportunity for a given lead — nothing downstream changes.
 */
export async function getCurrentBrand(): Promise<FranchiseBrandRecord | null> {
  const slug = getOpportunityProfile().slug;
  return getStore().getBrandBySlug(slug);
}

/** Display name to use in messaging when no brand row exists at all yet. */
export function fallbackBrandName(): string {
  return getOpportunityProfile().name;
}
