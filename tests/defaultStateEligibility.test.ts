/**
 * lib/territory/defaultStateEligibility.ts — the 14-state franchise
 * registration-law default, and its wiring into store.createBrand (see
 * the deadlock note there: seeding must happen outside the dev store's
 * withLock, since upsertStateEligibility takes its own lock and withLock
 * isn't reentrant — this test would hang forever if that regressed).
 */
import { mkdtempSync, rmSync } from "fs";
import os from "os";
import path from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { US_STATES } from "@/lib/geocoding/states";
import {
  FRANCHISE_REGISTRATION_STATES,
  defaultStateEligibilityRows,
  defaultStateEligibilityStatus,
} from "@/lib/territory/defaultStateEligibility";
import type { PortalStore } from "@/lib/store/types";

describe("defaultStateEligibilityStatus / defaultStateEligibilityRows", () => {
  it("marks exactly the 14 franchise-registration states not_registered, everything else approved", () => {
    expect(FRANCHISE_REGISTRATION_STATES).toHaveLength(14);
    expect([...FRANCHISE_REGISTRATION_STATES].sort()).toEqual(
      ["CA", "HI", "IL", "IN", "MD", "MI", "MN", "ND", "NY", "RI", "SD", "VA", "WA", "WI"].sort(),
    );

    for (const state of FRANCHISE_REGISTRATION_STATES) {
      expect(defaultStateEligibilityStatus(state)).toBe("not_registered");
    }

    const rows = defaultStateEligibilityRows();
    expect(rows).toHaveLength(US_STATES.length); // 50 states + DC
    const offStates = rows.filter((r) => r.status === "not_registered").map((r) => r.stateCode);
    const onStates = rows.filter((r) => r.status === "approved").map((r) => r.stateCode);
    expect(offStates.sort()).toEqual([...FRANCHISE_REGISTRATION_STATES].sort());
    expect(onStates).toHaveLength(US_STATES.length - 14);
    // A couple of spot checks against real, unambiguous cases.
    expect(onStates).toContain("TX");
    expect(onStates).toContain("FL");
    expect(offStates).toContain("CA");
    expect(offStates).toContain("NY");
  });

  it("is case-insensitive", () => {
    expect(defaultStateEligibilityStatus("ca")).toBe("not_registered");
    expect(defaultStateEligibilityStatus("tx")).toBe("approved");
  });
});

describe("store.createBrand seeds default state eligibility (dev store)", () => {
  const tmpDir = mkdtempSync(path.join(os.tmpdir(), "brand-eligibility-test-"));
  const originalCwd = process.cwd();
  let store: PortalStore;

  beforeAll(async () => {
    process.chdir(tmpDir);
    const storeModule = await import("@/lib/store");
    store = storeModule.getStore();
  });

  afterAll(() => {
    process.chdir(originalCwd);
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("seeds all 51 states with the correct default the moment a brand is created — regression guard against the withLock deadlock", async () => {
    const brand = await store.createBrand({ slug: "new-brand-test", name: "New Brand Test" });

    const rows = await store.listStateEligibility(brand.id);
    expect(rows).toHaveLength(US_STATES.length);

    const byState = new Map(rows.map((r) => [r.state_code, r.status]));
    for (const state of FRANCHISE_REGISTRATION_STATES) {
      expect(byState.get(state)).toBe("not_registered");
    }
    expect(byState.get("TX")).toBe("approved");
    expect(byState.get("TN")).toBe("approved");

    // The new brand is immediately usable — no state comes back
    // unconfigured (which the evaluator would otherwise treat as
    // manual-review-everywhere).
    for (const state of US_STATES) {
      expect(byState.has(state.code)).toBe(true);
    }
  });
});
