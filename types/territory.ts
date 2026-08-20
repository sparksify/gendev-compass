/**
 * Territory Advisor domain types. Field names mirror the Postgres columns in
 * supabase/migrations/0005_territory_advisor.sql exactly (see lib/store
 * conventions in types/lead.ts etc.).
 */

// ---------------------------------------------------------------------------
// franchise_brands
// ---------------------------------------------------------------------------
export interface FranchiseBrandRecord {
  id: string;
  slug: string;
  name: string;
  active: boolean;
  default_radius_miles: number;
  created_at: string;
  updated_at: string;
  /**
   * Platform domain link (nullable during the transition; backfilled to the
   * default organization by the platform migrations). franchise_brands is
   * THE brand entity for the whole platform — opportunities, FDD workflows,
   * and territory data all key off it.
   */
  organization_id: string | null;
}

// ---------------------------------------------------------------------------
// brand_state_eligibility
// ---------------------------------------------------------------------------
export const STATE_ELIGIBILITY_STATUSES = [
  "approved",
  "pending",
  "not_registered",
  "exempt",
  "restricted",
  "manual_review",
] as const;
export type StateEligibilityStatus = (typeof STATE_ELIGIBILITY_STATUSES)[number];

export const STATE_ELIGIBILITY_LABELS: Record<StateEligibilityStatus, string> = {
  approved: "Approved",
  pending: "Pending",
  not_registered: "Not Registered",
  exempt: "Exempt",
  restricted: "Restricted",
  manual_review: "Manual Review",
};

export interface BrandStateEligibilityRecord {
  id: string;
  brand_id: string;
  state_code: string;
  status: StateEligibilityStatus;
  effective_date: string | null;
  expiration_date: string | null;
  notes_internal: string | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// territory_definitions
// ---------------------------------------------------------------------------
export const TERRITORY_DEFINITION_TYPES = ["zip_list", "radius", "county", "polygon", "manual"] as const;
export type TerritoryDefinitionType = (typeof TERRITORY_DEFINITION_TYPES)[number];

export const TERRITORY_STATUSES = [
  "available",
  "reserved",
  "sold",
  "corporate",
  "unavailable",
  "pending",
  "archived",
] as const;
export type TerritoryStatus = (typeof TERRITORY_STATUSES)[number];

/** Statuses that represent a real conflict with a prospect's search. */
export const CONFLICTING_TERRITORY_STATUSES: TerritoryStatus[] = [
  "sold",
  "reserved",
  "corporate",
  "unavailable",
  "pending",
];

export const PUBLIC_DISPLAY_LEVELS = ["hidden", "generalized", "exact"] as const;
export type PublicDisplayLevel = (typeof PUBLIC_DISPLAY_LEVELS)[number];

export interface TerritoryDefinitionRecord {
  id: string;
  brand_id: string;
  territory_name: string;
  territory_code: string | null;
  definition_type: TerritoryDefinitionType;
  status: TerritoryStatus;
  center_latitude: number | null;
  center_longitude: number | null;
  radius_miles: number | null;
  public_display_level: PublicDisplayLevel;
  internal_notes: string | null;
  awarded_at: string | null;
  reserved_until: string | null;
  /** Original document this territory was marked from (e.g. an uploaded
   *  mapping-software report) — an audit trail, never shown to prospects. */
  source_document_url: string | null;
  source_document_filename: string | null;
  source_document_uploaded_at: string | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// territory_zip_codes
// ---------------------------------------------------------------------------
export interface TerritoryZipCodeRecord {
  id: string;
  territory_definition_id: string;
  zip_code: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// zip_code_reference
// ---------------------------------------------------------------------------
export interface ZipCodeReferenceRecord {
  zip_code: string;
  city: string;
  state_code: string;
  county_name: string | null;
  latitude: number;
  longitude: number;
  population: number | null;
  households: number | null;
  median_household_income: number | null;
  timezone: string | null;
  created_at: string;
  updated_at: string;
  /** 5-year population growth percentage (e.g. 8.2 for +8.2%), when known. */
  population_growth_pct: number | null;
  /** Provenance for the demographic figures (e.g. "US Census Bureau ACS 5-Year"). */
  demographics_source: string | null;
  /** Data vintage (e.g. "2019-2023"). */
  demographics_vintage: string | null;
}

/**
 * Upsert input for zip_code_reference. Demographic fields are optional:
 * when omitted, an update leaves any existing Census figures untouched
 * (so re-running the plain GeoNames import never wipes loaded demographics).
 */
export type UpsertZipCodeReferenceInput = Omit<
  ZipCodeReferenceRecord,
  | "population"
  | "households"
  | "median_household_income"
  | "population_growth_pct"
  | "demographics_source"
  | "demographics_vintage"
> &
  Partial<
    Pick<
      ZipCodeReferenceRecord,
      | "population"
      | "households"
      | "median_household_income"
      | "population_growth_pct"
      | "demographics_source"
      | "demographics_vintage"
    >
  >;

// ---------------------------------------------------------------------------
// territory_searches
// ---------------------------------------------------------------------------
export const TERRITORY_RESULT_STATUSES = [
  "AVAILABLE",
  "PARTIALLY_AVAILABLE",
  "UNAVAILABLE",
  "STATE_RESTRICTED",
  "MANUAL_REVIEW",
  "LOCATION_NOT_FOUND",
  "BRAND_NOT_CONFIGURED",
] as const;
export type TerritoryResultStatus = (typeof TERRITORY_RESULT_STATUSES)[number];

export interface TerritorySearchRecord {
  id: string;
  lead_id: string;
  brand_id: string;
  raw_query: string;
  normalized_location: string | null;
  latitude: number | null;
  longitude: number | null;
  city: string | null;
  state_code: string | null;
  zip_code: string | null;
  radius_miles: number | null;
  result_status: TerritoryResultStatus;
  result_summary: Record<string, unknown> | null;
  matched_territory_count: number;
  request_manual_review: boolean;
  created_at: string;
  /** Platform domain links (nullable during the transition). */
  organization_id: string | null;
  client_id: string | null;
  opportunity_id: string | null;
}

// ---------------------------------------------------------------------------
// territory_review_requests
// ---------------------------------------------------------------------------
export const TERRITORY_REVIEW_STATUSES = [
  "new",
  "in_review",
  "contacted",
  "approved",
  "declined",
  "closed",
] as const;
export type TerritoryReviewStatus = (typeof TERRITORY_REVIEW_STATUSES)[number];

export const TERRITORY_REVIEW_STATUS_LABELS: Record<TerritoryReviewStatus, string> = {
  new: "New",
  in_review: "In Review",
  contacted: "Contacted",
  approved: "Approved",
  declined: "Declined",
  closed: "Closed",
};

export interface TerritoryReviewRequestRecord {
  id: string;
  lead_id: string;
  brand_id: string;
  territory_search_id: string | null;
  status: TerritoryReviewStatus;
  prospect_message: string | null;
  assigned_to: string | null;
  reviewed_at: string | null;
  internal_notes: string | null;
  created_at: string;
  updated_at: string;
  /** Platform domain links (nullable during the transition). */
  organization_id: string | null;
  client_id: string | null;
  opportunity_id: string | null;
}

// ---------------------------------------------------------------------------
// Client-facing structured evaluation result (sanitized — never includes
// internal_notes, exact private boundaries, or franchisee identity).
// ---------------------------------------------------------------------------
export interface TerritoryAlternative {
  label: string;
  city: string | null;
  stateCode: string | null;
  zipCode: string | null;
  distanceMiles: number | null;
  status: TerritoryResultStatus;
  /** Public ZIP centroid, for plotting the market on the prospect map. */
  latitude?: number | null;
  longitude?: number | null;
}

export interface TerritoryEvaluationResult {
  status: TerritoryResultStatus;
  brandId: string;
  brandName: string;
  location: {
    query: string;
    displayName: string | null;
    city: string | null;
    stateCode: string | null;
    zipCode: string | null;
    latitude: number | null;
    longitude: number | null;
  };
  stateEligibility: {
    status: StateEligibilityStatus | null;
  };
  evaluation: {
    radiusMiles: number;
    zipCodes: string[];
    matchedTerritoryCount: number;
    overlapPercentage: number;
  };
  marketData: {
    population: number | null;
    households: number | null;
    medianHouseholdIncome: number | null;
    /** Population-weighted 5-year growth % across the evaluated ZIPs, when known. */
    populationGrowthPct?: number | null;
    /** How many of the evaluated ZIPs carried demographic data (transparency). */
    zipsWithData?: number;
    /** Provenance of the figures (e.g. "U.S. Census Bureau, ACS 5-Year 2019–2023"). */
    source?: string | null;
  };
  alternatives: TerritoryAlternative[];
  checkedAt: string;
  requiresManualReview: boolean;
  message: string;
  searchId: string | null;
  /** Present only when status === LOCATION_NOT_FOUND and multiple candidates matched. */
  candidates?: Array<{ label: string; city: string; stateCode: string; zipCode: string }>;
}

// ---------------------------------------------------------------------------
// zip_code_geographies (0008/0009) — ZIP boundary layer. `geojson` is a
// simplified display-grade GeoJSON geometry (Polygon/MultiPolygon); the
// PostGIS geometry column is not exposed through the store.
// ---------------------------------------------------------------------------
export interface ZipGeographyRecord {
  zip_code: string;
  state_code: string | null;
  latitude: number;
  longitude: number;
  /** Simplified GeoJSON geometry (display grade), or null if not loaded. */
  geojson: Record<string, unknown> | null;
  geometry_source: string | null;
  geometry_version: string | null;
}

export interface UpsertZipGeographyInput {
  zip_code: string;
  state_code: string;
  latitude: number;
  longitude: number;
  geojson: Record<string, unknown>;
  geometry_source: string;
  geometry_version: string;
}

// ---------------------------------------------------------------------------
// census_import_jobs (0011) — backend job tracking for the Census ACS
// import. Census data is infrastructure: it's loaded and refreshed by a
// server-side job independent of the browser, never by a user clicking a
// button and waiting on a request loop. See lib/geocoding/censusJob.ts.
// ---------------------------------------------------------------------------
export type CensusImportJobStatus = "running" | "succeeded" | "failed";
/** What started the job: the scheduled health-check cron, a staff member's
 *  manual "Run Manual Refresh" click, or the system auto-detecting empty
 *  data (e.g. right after a fresh deploy) with no human involved. */
export type CensusImportJobTrigger = "cron" | "manual" | "system";

export interface CensusImportJobRecord {
  id: string;
  status: CensusImportJobStatus;
  trigger: CensusImportJobTrigger;
  vintage: string;
  states_total: number;
  states_done: number;
  states_failed: number;
  last_error: string | null;
  started_at: string;
  finished_at: string | null;
  updated_at: string;
}

export interface CreateCensusImportJobInput {
  trigger: CensusImportJobTrigger;
  vintage: string;
  states_total: number;
}

export interface CensusImportJobPatch {
  status?: CensusImportJobStatus;
  states_done?: number;
  states_failed?: number;
  last_error?: string | null;
  finished_at?: string | null;
}

/**
 * Durable raw layer: the Census figures per ZCTA exactly as returned by the
 * ACS API for one state/vintage, before being joined onto our own ZIP
 * reference (city/state/lat/lng) and written to zip_code_reference (the
 * normalized layer the application actually queries). Lets a bad
 * normalization run be reprocessed without re-fetching from census.gov.
 * One row per (vintage, state) — a re-fetch replaces the prior capture.
 */
export interface CensusAcsRawRecord {
  id: string;
  job_id: string | null;
  vintage: string;
  state_code: string;
  variables: string[];
  payload: Record<string, Record<string, number | null>>;
  fetched_at: string;
}

export interface RecordCensusRawImportInput {
  job_id: string | null;
  vintage: string;
  state_code: string;
  variables: string[];
  payload: Record<string, Record<string, number | null>>;
}
