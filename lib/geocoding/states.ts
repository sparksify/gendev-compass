/** All 50 states + DC, for state-name parsing and admin eligibility grids. */
export const US_STATES: Array<{ code: string; name: string }> = [
  { code: "AL", name: "Alabama" },
  { code: "AK", name: "Alaska" },
  { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" },
  { code: "CA", name: "California" },
  { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" },
  { code: "DE", name: "Delaware" },
  { code: "DC", name: "District of Columbia" },
  { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" },
  { code: "HI", name: "Hawaii" },
  { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" },
  { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" },
  { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" },
  { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" },
  { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" },
  { code: "MT", name: "Montana" },
  { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" },
  { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" },
  { code: "NY", name: "New York" },
  { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" },
  { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" },
  { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" },
  { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" },
  { code: "UT", name: "Utah" },
  { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" },
  { code: "WA", name: "Washington" },
  { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" },
  { code: "WY", name: "Wyoming" },
];

/**
 * The 14 states most commonly cited as requiring franchise registration
 * (CA, HI, IL, IN, MD, MI, MN, NY, ND, RI, SD, VA, WA, WI). Reference only —
 * the app never hard-codes an assumption that these are unavailable; actual
 * eligibility always comes from brand_state_eligibility, and an unconfigured
 * state resolves to MANUAL_REVIEW regardless of whether it appears here.
 */
export const FRANCHISE_REGISTRATION_STATES: string[] = [
  "CA",
  "HI",
  "IL",
  "IN",
  "MD",
  "MI",
  "MN",
  "NY",
  "ND",
  "RI",
  "SD",
  "VA",
  "WA",
  "WI",
];

const NAME_TO_CODE = new Map(US_STATES.map((s) => [s.name.toLowerCase(), s.code]));
const CODE_SET = new Set(US_STATES.map((s) => s.code));

/** Resolves "Texas", "TX", or "tx" to a USPS code; null if unrecognized. */
export function normalizeStateToken(token: string): string | null {
  const trimmed = token.trim();
  if (!trimmed) return null;
  const upper = trimmed.toUpperCase();
  if (upper.length === 2 && CODE_SET.has(upper)) return upper;
  return NAME_TO_CODE.get(trimmed.toLowerCase()) ?? null;
}

export function stateName(code: string): string {
  return US_STATES.find((s) => s.code === code)?.name ?? code;
}
