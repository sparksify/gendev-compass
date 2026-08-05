import { getStore } from "@/lib/store";
import { getDefaultOrganizationSlug } from "@/lib/config/env";
import type { OrganizationRecord } from "@/types/domain";

/**
 * Organization service. GenDev is the first (and initially only) tenant;
 * the default organization is resolved by slug and created on demand so
 * environments that have not run the SQL backfill (local dev store,
 * previews) converge to the same shape.
 */

export async function getOrganizationBySlug(slug: string): Promise<OrganizationRecord | null> {
  return getStore().getOrganizationBySlug(slug);
}

export async function resolveDefaultOrganization(): Promise<OrganizationRecord> {
  const store = getStore();
  const slug = getDefaultOrganizationSlug();
  const existing = await store.getOrganizationBySlug(slug);
  if (existing) return existing;
  try {
    return await store.createOrganization({
      name: slug === "gendev" ? "GenDev" : slug,
      slug,
      organization_type: "FSO",
    });
  } catch {
    // Concurrent creation: another request won the race — reuse its row.
    const raced = await store.getOrganizationBySlug(slug);
    if (raced) return raced;
    throw new Error(`Failed to resolve default organization '${slug}'`);
  }
}
