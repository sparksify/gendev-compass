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
}

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
  };
  alternatives: TerritoryAlternative[];
  checkedAt: string;
  requiresManualReview: boolean;
  message: string;
  searchId: string | null;
  /** Present only when status === LOCATION_NOT_FOUND and multiple candidates matched. */
  candidates?: Array<{ label: string; city: string; stateCode: string; zipCode: string }>;
}
