/**
 * Territory Advisor tuning. Nothing in the API routes or evaluation service
 * should hardcode these values — mirrors the convention in
 * lib/config/qualification.ts.
 */

export const RADIUS_OPTIONS_MILES = [5, 10, 15, 25] as const;
export type RadiusOptionMiles = (typeof RADIUS_OPTIONS_MILES)[number];

function intFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Fallback radius when a brand has no default_radius_miles configured. */
export function getDefaultRadiusMiles(): number {
  const value = intFromEnv("DEFAULT_TERRITORY_RADIUS_MILES", 10);
  return RADIUS_OPTIONS_MILES.includes(value as RadiusOptionMiles) ? value : 10;
}

/** Overlap percentage at/above which a searched area is treated as fully conflicting. */
export const UNAVAILABLE_OVERLAP_THRESHOLD = 75;

/** How far past the searched radius to look for alternative markets. */
export const ALTERNATIVE_SEARCH_MULTIPLIER = 2.5;
export const ALTERNATIVE_SEARCH_MAX_MILES = 40;
export const MAX_ALTERNATIVES = 3;
