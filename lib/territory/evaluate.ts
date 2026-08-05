import { getStore } from "@/lib/store";
import { getGeocodingProvider, haversineMiles, type GeocodeCandidate, type NearbyZip } from "@/lib/geocoding";
import {
  ALTERNATIVE_SEARCH_MAX_MILES,
  ALTERNATIVE_SEARCH_MULTIPLIER,
  MAX_ALTERNATIVES,
  UNAVAILABLE_OVERLAP_THRESHOLD,
} from "@/lib/config/territory";
import { messageForStatus } from "./messages";
import {
  CONFLICTING_TERRITORY_STATUSES,
  type StateEligibilityStatus,
  type TerritoryAlternative,
  type TerritoryDefinitionRecord,
  type TerritoryEvaluationResult,
  type TerritoryResultStatus,
} from "@/types/territory";

export interface EvaluateTerritoryInput {
  brandId: string;
  query: string;
  radiusMiles: number;
  leadId: string;
  /** Skip persisting a territory_searches row (used for read-only previews). */
  skipPersist?: boolean;
  /** When set, resolves the location via reverse geocoding instead of parsing `query` text. */
  coordinates?: { latitude: number; longitude: number };
  /**
   * Platform domain links (optional; stamped from the lead's chain so the
   * search attaches to a specific brand opportunity).
   */
  links?: {
    organization_id?: string | null;
    client_id?: string | null;
    opportunity_id?: string | null;
  };
}

/** States pass through to territory evaluation; everything else stops the check. */
function stateAllowsEvaluation(status: StateEligibilityStatus | null): boolean {
  return status === "approved" || status === "exempt";
}

function stateResultStatus(status: StateEligibilityStatus): TerritoryResultStatus | null {
  if (status === "approved" || status === "exempt") return null;
  if (status === "restricted" || status === "not_registered") return "STATE_RESTRICTED";
  return "MANUAL_REVIEW"; // pending, manual_review
}

function isReservationActive(territory: TerritoryDefinitionRecord, now: Date): boolean {
  if (territory.status !== "reserved") return true;
  if (!territory.reserved_until) return true;
  return new Date(territory.reserved_until).getTime() > now.getTime();
}

/** Circle/circle overlap, approximated as a 0–100 percentage of the searched area. */
function circleOverlapPercentage(
  searchLat: number,
  searchLng: number,
  searchRadius: number,
  territory: TerritoryDefinitionRecord,
): number {
  if (territory.center_latitude == null || territory.center_longitude == null) return 0;
  const territoryRadius = territory.radius_miles ?? 0;
  const distance = haversineMiles(searchLat, searchLng, territory.center_latitude, territory.center_longitude);
  if (distance >= searchRadius + territoryRadius) return 0; // no overlap
  if (distance <= Math.abs(searchRadius - territoryRadius)) {
    // One circle fully contains the other.
    return territoryRadius >= searchRadius ? 100 : Math.round((territoryRadius / searchRadius) * 100);
  }
  const overlapDepth = searchRadius + territoryRadius - distance;
  const denominator = 2 * Math.min(searchRadius, territoryRadius);
  return Math.max(0, Math.min(100, Math.round((overlapDepth / denominator) * 100)));
}

interface ConflictCheck {
  matchedTerritories: TerritoryDefinitionRecord[];
  overlapPercentage: number;
  requiresManualReview: boolean;
  /** True when the exact searched point/ZIP — not just the wider radius — falls inside a conflict. */
  exactMatch: boolean;
}

async function checkTerritoryConflicts(
  brandId: string,
  searchLat: number,
  searchLng: number,
  searchRadiusMiles: number,
  evaluatedZipCodes: string[],
  exactZipCode?: string | null,
): Promise<ConflictCheck> {
  const store = getStore();
  const territories = await store.listTerritoryDefinitions(brandId);
  const now = new Date();
  const matched: TerritoryDefinitionRecord[] = [];
  let maxOverlap = 0;
  let requiresManualReview = false;
  let exactMatch = false;

  for (const territory of territories) {
    if (territory.status === "archived") continue;
    if (territory.definition_type === "county" || territory.definition_type === "polygon") {
      // Not evaluable yet — flag for staff rather than guessing.
      requiresManualReview = true;
      continue;
    }
    const isConflictingStatus = (CONFLICTING_TERRITORY_STATUSES as string[]).includes(territory.status);
    if (!isConflictingStatus) continue;
    if (!isReservationActive(territory, now)) continue; // expired reservation — treat as available

    if (territory.definition_type === "zip_list") {
      const zips = await store.listZipCodesForTerritory(territory.id);
      const zipSet = new Set(zips.map((z) => z.zip_code));
      const overlappingZips = evaluatedZipCodes.filter((z) => zipSet.has(z));
      if (overlappingZips.length > 0) {
        matched.push(territory);
        const overlapPct = Math.round((overlappingZips.length / Math.max(1, evaluatedZipCodes.length)) * 100);
        maxOverlap = Math.max(maxOverlap, overlapPct);
        if (exactZipCode && zipSet.has(exactZipCode)) exactMatch = true;
      }
    } else if (territory.definition_type === "radius") {
      const overlapPct = circleOverlapPercentage(searchLat, searchLng, searchRadiusMiles, territory);
      if (overlapPct > 0) {
        matched.push(territory);
        maxOverlap = Math.max(maxOverlap, overlapPct);
        // The searched point itself sits inside the conflicting circle.
        if (territory.center_latitude != null && territory.center_longitude != null) {
          const centerDistance = haversineMiles(searchLat, searchLng, territory.center_latitude, territory.center_longitude);
          if (centerDistance <= (territory.radius_miles ?? 0)) exactMatch = true;
        }
      }
    } else if (territory.definition_type === "manual") {
      requiresManualReview = true;
    }
  }

  return { matchedTerritories: matched, overlapPercentage: maxOverlap, requiresManualReview, exactMatch };
}

async function findAlternatives(
  brandId: string,
  candidate: GeocodeCandidate,
  searchRadiusMiles: number,
  conflictingZips: Set<string>,
): Promise<TerritoryAlternative[]> {
  const provider = getGeocodingProvider();
  const store = getStore();
  const wideRadius = Math.min(
    ALTERNATIVE_SEARCH_MAX_MILES,
    searchRadiusMiles * ALTERNATIVE_SEARCH_MULTIPLIER,
  );
  const nearby = await provider.findNearbyZipCodes(candidate.latitude, candidate.longitude, wideRadius);
  const seenCities = new Set<string>();
  const alternatives: TerritoryAlternative[] = [];

  for (const zip of nearby) {
    if (zip.distanceMiles <= searchRadiusMiles) continue; // inside the original search — not "nearby"
    if (conflictingZips.has(zip.zipCode)) continue;
    const cityKey = `${zip.city.toLowerCase()}|${zip.stateCode}`;
    if (seenCities.has(cityKey)) continue;

    const eligibility = await store.getStateEligibility(brandId, zip.stateCode);
    if (!stateAllowsEvaluation(eligibility?.status ?? null)) continue;

    const conflict = await checkTerritoryConflicts(brandId, zip.latitude, zip.longitude, 5, [zip.zipCode], zip.zipCode);
    const status: TerritoryResultStatus = conflict.matchedTerritories.length > 0 ? "UNAVAILABLE" : "AVAILABLE";
    if (status !== "AVAILABLE") continue;

    seenCities.add(cityKey);
    alternatives.push({
      label: `${zip.city}, ${zip.stateCode}`,
      city: zip.city,
      stateCode: zip.stateCode,
      zipCode: zip.zipCode,
      distanceMiles: Math.round(zip.distanceMiles * 10) / 10,
      status,
      latitude: zip.latitude,
      longitude: zip.longitude,
    });
    if (alternatives.length >= MAX_ALTERNATIVES) break;
  }

  return alternatives;
}

/**
 * Aggregates real demographic figures across every evaluated ZIP so the
 * market analysis describes the whole search area, not one ZIP: population
 * and households sum; income is a household-weighted average of ZIP medians;
 * growth is population-weighted. Missing data stays null — never invented.
 */
export function aggregateMarketData(nearby: NearbyZip[]): TerritoryEvaluationResult["marketData"] {
  const withData = nearby.filter((z) => z.population != null || z.medianHouseholdIncome != null);
  if (withData.length === 0) {
    return { population: null, households: null, medianHouseholdIncome: null, populationGrowthPct: null, zipsWithData: 0, source: null };
  }

  let population = 0;
  let hasPopulation = false;
  let households = 0;
  let hasHouseholds = false;
  let incomeWeighted = 0;
  let incomeWeight = 0;
  let growthWeighted = 0;
  let growthWeight = 0;

  for (const zip of withData) {
    if (zip.population != null) {
      population += zip.population;
      hasPopulation = true;
    }
    if (zip.households != null) {
      households += zip.households;
      hasHouseholds = true;
    }
    if (zip.medianHouseholdIncome != null) {
      const weight = zip.households ?? zip.population ?? 1;
      incomeWeighted += zip.medianHouseholdIncome * weight;
      incomeWeight += weight;
    }
    if (zip.populationGrowthPct != null) {
      const weight = zip.population ?? 1;
      growthWeighted += zip.populationGrowthPct * weight;
      growthWeight += weight;
    }
  }

  return {
    population: hasPopulation ? population : null,
    households: hasHouseholds ? households : null,
    medianHouseholdIncome: incomeWeight > 0 ? Math.round(incomeWeighted / incomeWeight) : null,
    populationGrowthPct: growthWeight > 0 ? Math.round((growthWeighted / growthWeight) * 10) / 10 : null,
    zipsWithData: withData.length,
    source: withData.find((z) => z.demographicsSource)?.demographicsSource ?? null,
  };
}

async function buildResult(
  status: TerritoryResultStatus,
  opts: {
    brandId: string;
    brandName: string;
    rawQuery: string;
    candidate: GeocodeCandidate | null;
    candidates?: GeocodeCandidate[];
    radiusMiles: number;
    stateEligibilityStatus: StateEligibilityStatus | null;
    evaluatedZipCodes?: string[];
    matchedTerritoryCount?: number;
    overlapPercentage?: number;
    marketData?: { population: number | null; households: number | null; medianHouseholdIncome: number | null };
    alternatives?: TerritoryAlternative[];
    requiresManualReview?: boolean;
  },
): Promise<TerritoryEvaluationResult> {
  const alternatives = opts.alternatives ?? [];
  return {
    status,
    brandId: opts.brandId,
    brandName: opts.brandName,
    location: {
      query: opts.rawQuery,
      displayName: opts.candidate?.label ?? null,
      city: opts.candidate?.city ?? null,
      stateCode: opts.candidate?.stateCode ?? null,
      zipCode: opts.candidate?.zipCode ?? null,
      latitude: opts.candidate?.latitude ?? null,
      longitude: opts.candidate?.longitude ?? null,
    },
    stateEligibility: { status: opts.stateEligibilityStatus },
    evaluation: {
      radiusMiles: opts.radiusMiles,
      zipCodes: opts.evaluatedZipCodes ?? [],
      matchedTerritoryCount: opts.matchedTerritoryCount ?? 0,
      overlapPercentage: opts.overlapPercentage ?? 0,
    },
    marketData:
      opts.marketData ??
      { population: null, households: null, medianHouseholdIncome: null, populationGrowthPct: null, zipsWithData: 0, source: null },
    alternatives,
    checkedAt: new Date().toISOString(),
    requiresManualReview: opts.requiresManualReview ?? false,
    message: messageForStatus(status, {
      brandName: opts.brandName,
      locationLabel: opts.candidate?.label ?? opts.rawQuery,
      stateCode: opts.candidate?.stateCode ?? null,
      alternativeCount: alternatives.length,
      candidateCount: opts.candidates?.length,
      stateEligibilityStatus: opts.stateEligibilityStatus,
    }),
    searchId: null,
    candidates: opts.candidates?.map((c) => ({
      label: c.label,
      city: c.city ?? c.label,
      stateCode: c.stateCode,
      zipCode: c.zipCode ?? "",
    })),
  };
}

/**
 * Builds a BRAND_NOT_CONFIGURED result without touching the store — used
 * when no franchise_brands row exists at all yet (so there's no brand_id to
 * satisfy the territory_searches foreign key against).
 */
export function unconfiguredBrandResult(query: string, brandNameFallback: string): TerritoryEvaluationResult {
  return {
    status: "BRAND_NOT_CONFIGURED",
    brandId: "",
    brandName: brandNameFallback,
    location: { query, displayName: null, city: null, stateCode: null, zipCode: null, latitude: null, longitude: null },
    stateEligibility: { status: null },
    evaluation: { radiusMiles: 0, zipCodes: [], matchedTerritoryCount: 0, overlapPercentage: 0 },
    marketData: { population: null, households: null, medianHouseholdIncome: null, populationGrowthPct: null, zipsWithData: 0, source: null },
    alternatives: [],
    checkedAt: new Date().toISOString(),
    requiresManualReview: false,
    message: messageForStatus("BRAND_NOT_CONFIGURED", {
      brandName: brandNameFallback,
      locationLabel: query,
      stateCode: null,
      alternativeCount: 0,
    }),
    searchId: null,
  };
}

/**
 * Deterministic territory-availability evaluation. This — not any LLM — is
 * the single source of truth for status, overlap, state eligibility, and
 * alternatives. See lib/territory/intent.ts for the conversational layer
 * that turns follow-up chat messages into calls to this function.
 */
export async function evaluateTerritory(input: EvaluateTerritoryInput): Promise<TerritoryEvaluationResult> {
  const store = getStore();
  const brand = await store.getBrandById(input.brandId);

  if (!brand || !brand.active) {
    const result = await buildResult("BRAND_NOT_CONFIGURED", {
      brandId: input.brandId,
      brandName: brand?.name ?? "This opportunity",
      rawQuery: input.query,
      candidate: null,
      radiusMiles: input.radiusMiles,
      stateEligibilityStatus: null,
    });
    return persist(result, input, "BRAND_NOT_CONFIGURED");
  }

  const provider = getGeocodingProvider();
  const candidates = input.coordinates
    ? await (async () => {
        const reverse = await provider.reverseGeocode(input.coordinates!.latitude, input.coordinates!.longitude);
        return reverse ? [reverse] : [];
      })()
    : await provider.geocode(input.query);

  if (candidates.length === 0) {
    const result = await buildResult("LOCATION_NOT_FOUND", {
      brandId: brand.id,
      brandName: brand.name,
      rawQuery: input.query,
      candidate: null,
      radiusMiles: input.radiusMiles,
      stateEligibilityStatus: null,
    });
    return persist(result, input, "LOCATION_NOT_FOUND");
  }

  if (candidates.length > 1) {
    const result = await buildResult("LOCATION_NOT_FOUND", {
      brandId: brand.id,
      brandName: brand.name,
      rawQuery: input.query,
      candidate: null,
      candidates,
      radiusMiles: input.radiusMiles,
      stateEligibilityStatus: null,
    });
    return persist(result, input, "LOCATION_NOT_FOUND");
  }

  const candidate = candidates[0];
  const eligibility = await store.getStateEligibility(brand.id, candidate.stateCode);

  // No configuration for this state at all → manual review, never "available".
  if (!eligibility) {
    const result = await buildResult("MANUAL_REVIEW", {
      brandId: brand.id,
      brandName: brand.name,
      rawQuery: input.query,
      candidate,
      radiusMiles: input.radiusMiles,
      stateEligibilityStatus: null,
      requiresManualReview: true,
    });
    return persist(result, input, "MANUAL_REVIEW", candidate);
  }

  const blockedStatus = stateResultStatus(eligibility.status);
  if (blockedStatus) {
    const result = await buildResult(blockedStatus, {
      brandId: brand.id,
      brandName: brand.name,
      rawQuery: input.query,
      candidate,
      radiusMiles: input.radiusMiles,
      stateEligibilityStatus: eligibility.status,
      requiresManualReview: blockedStatus === "MANUAL_REVIEW",
    });
    return persist(result, input, blockedStatus, candidate);
  }

  // Determine the evaluated ZIP set.
  const nearby = await provider.findNearbyZipCodes(candidate.latitude, candidate.longitude, input.radiusMiles);
  const evaluatedZipCodes = candidate.zipCode
    ? [...new Set([candidate.zipCode, ...nearby.map((z) => z.zipCode)])]
    : nearby.map((z) => z.zipCode);
  const conflicts = await checkTerritoryConflicts(
    brand.id,
    candidate.latitude,
    candidate.longitude,
    input.radiusMiles,
    evaluatedZipCodes,
    candidate.zipCode,
  );

  let status: TerritoryResultStatus;
  if (conflicts.requiresManualReview && conflicts.matchedTerritories.length === 0) {
    status = "MANUAL_REVIEW";
  } else if (conflicts.matchedTerritories.length === 0) {
    status = "AVAILABLE";
  } else if (conflicts.exactMatch || conflicts.overlapPercentage >= UNAVAILABLE_OVERLAP_THRESHOLD) {
    // The exact searched point/ZIP conflicts directly — treat as unavailable
    // even if the wider radius is only partially affected (see spec: "this
    // specific market appears to overlap..."). A city/radius search that
    // merely brushes a conflicting territory without hitting it exactly
    // falls through to PARTIALLY_AVAILABLE instead.
    status = "UNAVAILABLE";
  } else {
    status = "PARTIALLY_AVAILABLE";
  }

  let alternatives: TerritoryAlternative[] = [];
  if (status === "UNAVAILABLE" || status === "PARTIALLY_AVAILABLE") {
    const conflictingZipSet = new Set(evaluatedZipCodes.filter((z) => z !== candidate.zipCode));
    alternatives = await findAlternatives(brand.id, candidate, input.radiusMiles, conflictingZipSet);
  }

  const result = await buildResult(status, {
    brandId: brand.id,
    brandName: brand.name,
    rawQuery: input.query,
    candidate,
    radiusMiles: input.radiusMiles,
    stateEligibilityStatus: eligibility.status,
    evaluatedZipCodes,
    matchedTerritoryCount: conflicts.matchedTerritories.length,
    overlapPercentage: conflicts.overlapPercentage,
    marketData: aggregateMarketData(nearby),
    alternatives,
    requiresManualReview: status === "MANUAL_REVIEW" || conflicts.requiresManualReview,
  });

  return persist(result, input, status, candidate);
}

async function persist(
  result: TerritoryEvaluationResult,
  input: EvaluateTerritoryInput,
  status: TerritoryResultStatus,
  candidate?: GeocodeCandidate,
): Promise<TerritoryEvaluationResult> {
  if (input.skipPersist) return result;
  const store = getStore();
  try {
    const record = await store.createTerritorySearch({
      lead_id: input.leadId,
      brand_id: input.brandId,
      raw_query: input.query,
      normalized_location: candidate?.label ?? null,
      latitude: candidate?.latitude ?? null,
      longitude: candidate?.longitude ?? null,
      city: candidate?.city ?? null,
      state_code: candidate?.stateCode ?? null,
      zip_code: candidate?.zipCode ?? null,
      radius_miles: input.radiusMiles,
      result_status: status,
      result_summary: sanitizeForStorage(result),
      matched_territory_count: result.evaluation.matchedTerritoryCount,
      request_manual_review: result.requiresManualReview,
      organization_id: input.links?.organization_id ?? null,
      client_id: input.links?.client_id ?? null,
      opportunity_id: input.links?.opportunity_id ?? null,
    });
    return { ...result, searchId: record.id };
  } catch (error) {
    // Search logging must never break the prospect-facing flow.
    console.error("[territory] failed to save search record:", error);
    return result;
  }
}

/** result already excludes internal notes/exact boundaries; JSON-safe for jsonb storage. */
function sanitizeForStorage(result: TerritoryEvaluationResult): Record<string, unknown> {
  return JSON.parse(JSON.stringify(result));
}
