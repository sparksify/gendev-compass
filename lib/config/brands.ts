/**
 * Brand registry for the activation flow. The rest of the app is still a
 * single-brand deployment (see lib/config/brand.ts, lib/config/opportunity.ts) —
 * this registry exists so /activate?brand=<slug> can validate its input and
 * so leads/activations can be scoped by brand without inventing a full
 * multi-tenant brand system. Add an entry here when a second brand launches.
 */
export interface BrandRegistryEntry {
  slug: string;
  /** Where a successfully matched lead for this brand is redirected. */
  portalPath: (portalToken: string) => string;
}

const BRAND_REGISTRY: Record<string, BrandRegistryEntry> = {
  cmdt: {
    slug: "cmdt",
    portalPath: (portalToken) => `/p/${portalToken}`,
  },
};

export function isValidBrandSlug(slug: string): boolean {
  return Object.prototype.hasOwnProperty.call(BRAND_REGISTRY, slug);
}

export function getBrandEntry(slug: string): BrandRegistryEntry | null {
  return BRAND_REGISTRY[slug] ?? null;
}
