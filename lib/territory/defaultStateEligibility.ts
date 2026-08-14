import { US_STATES } from "@/lib/geocoding/states";
import type { StateEligibilityStatus } from "@/types/territory";

/**
 * States with franchise registration/relationship laws requiring the
 * franchisor to register (and file/update an FDD) with the state before
 * offering or selling a franchise there — California, Hawaii, Illinois,
 * Indiana, Maryland, Michigan, Minnesota, New York, North Dakota, Rhode
 * Island, South Dakota, Virginia, Washington, Wisconsin.
 *
 * Business decision (2026-08): every brand defaults to these 14 states
 * OFF ("not_registered") and every other state ON ("approved"), so
 * bringing on a new brand or mapping more territory never requires
 * manually flipping the other ~36 states on one at a time — only these
 * 14 need attention (once registered, flip to "approved" like any other
 * state eligibility change). This is the seeded default only; every row
 * remains individually editable afterward via the State Eligibility admin
 * grid — nothing here prevents turning any of the 14 on, or any other
 * state off, per brand.
 */
export const FRANCHISE_REGISTRATION_STATES = [
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
] as const;

const REGISTRATION_STATE_SET = new Set<string>(FRANCHISE_REGISTRATION_STATES);

export function defaultStateEligibilityStatus(stateCode: string): StateEligibilityStatus {
  return REGISTRATION_STATE_SET.has(stateCode.toUpperCase()) ? "not_registered" : "approved";
}

/** Every US state + DC's default status for a brand new to the system. */
export function defaultStateEligibilityRows(): Array<{ stateCode: string; status: StateEligibilityStatus }> {
  return US_STATES.map((s) => ({ stateCode: s.code, status: defaultStateEligibilityStatus(s.code) }));
}
