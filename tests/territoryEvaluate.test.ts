/**
 * Integration tests for the Territory Advisor evaluation service against
 * the file-backed dev store (same PortalStore interface as Supabase) — same
 * pattern as tests/storeFlows.test.ts. No e2e/browser test runner exists in
 * this repo (no Playwright config), so the closest equivalent to the spec's
 * "portal user searches → views map → requests review → sees success"
 * journey is the "full prospect journey" integration test below, which
 * exercises the same service-layer calls a real request would make.
 */
import { mkdtempSync, rmSync } from "fs";
import os from "os";
import path from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PortalStore } from "@/lib/store/types";
import type { LeadRecord } from "@/types/lead";
import type { FranchiseBrandRecord } from "@/types/territory";

const tmpDir = mkdtempSync(path.join(os.tmpdir(), "territory-test-"));
const originalCwd = process.cwd();

let store: PortalStore;
let evaluateTerritory: typeof import("@/lib/territory/evaluate").evaluateTerritory;
let resolveFollowUp: typeof import("@/lib/territory/intent").resolveFollowUp;
let dispatchTerritoryReviewWebhook: typeof import("@/lib/territory/webhook").dispatchTerritoryReviewWebhook;
let isAdmin: typeof import("@/lib/advisor/access").isAdmin;

beforeAll(async () => {
  process.chdir(tmpDir);
  const storeModule = await import("@/lib/store");
  store = storeModule.getStore();
  ({ evaluateTerritory } = await import("@/lib/territory/evaluate"));
  ({ resolveFollowUp } = await import("@/lib/territory/intent"));
  ({ dispatchTerritoryReviewWebhook } = await import("@/lib/territory/webhook"));
  ({ isAdmin } = await import("@/lib/advisor/access"));
});

afterAll(() => {
  process.chdir(originalCwd);
  rmSync(tmpDir, { recursive: true, force: true });
});

let leadCounter = 0;
async function createLead(): Promise<LeadRecord> {
  leadCounter += 1;
  return store.createLead({
    portal_token: `territory-test-token-${leadCounter}-0123456789abcdef`,
    first_name: "Test",
    last_name: `Prospect${leadCounter}`,
    email: `prospect${leadCounter}@example.test`,
    phone: null,
    state: null,
    source: null,
    campaign: null,
    ad_set: null,
    ad: null,
    facebook_lead_id: null,
    initial_liquid_capital: null,
    initial_net_worth: null,
    initial_business_owner: null,
  });
}

let brandCounter = 0;
async function createBrand(): Promise<FranchiseBrandRecord> {
  brandCounter += 1;
  return store.createBrand({ slug: `test-brand-${brandCounter}`, name: `Test Brand ${brandCounter}`, default_radius_miles: 10 });
}

/** Seeds two ZIP-reference rows ~2 miles apart in the same city, plus a third far away in another state. */
async function seedZips(state = "TX") {
  const now = new Date().toISOString();
  await store.upsertZipCodeReferences([
    { zip_code: "10001", city: "Centerville", state_code: state, county_name: null, latitude: 32.0, longitude: -96.0, population: 10000, households: 4000, median_household_income: 60000, timezone: "America/Chicago", created_at: now, updated_at: now },
    { zip_code: "10002", city: "Centerville", state_code: state, county_name: null, latitude: 32.02, longitude: -96.0, population: 8000, households: 3200, median_household_income: 58000, timezone: "America/Chicago", created_at: now, updated_at: now },
    { zip_code: "10003", city: "Centerville", state_code: state, county_name: null, latitude: 32.3, longitude: -96.0, population: 5000, households: 2000, median_household_income: 55000, timezone: "America/Chicago", created_at: now, updated_at: now },
    { zip_code: "20001", city: "Faraway", state_code: "ZZ", county_name: null, latitude: 45.0, longitude: -120.0, population: 3000, households: 1200, median_household_income: 50000, timezone: "America/Los_Angeles", created_at: now, updated_at: now },
  ]);
}

describe("evaluateTerritory", () => {
  it("1. approved state + no overlap → AVAILABLE", async () => {
    await seedZips();
    const brand = await createBrand();
    const lead = await createLead();
    await store.upsertStateEligibility({ brand_id: brand.id, state_code: "TX", status: "approved" });

    const result = await evaluateTerritory({ brandId: brand.id, query: "10001", radiusMiles: 10, leadId: lead.id });
    expect(result.status).toBe("AVAILABLE");
    expect(result.evaluation.matchedTerritoryCount).toBe(0);
  });

  it("2. approved state + full overlap (exact ZIP sold) → UNAVAILABLE", async () => {
    await seedZips();
    const brand = await createBrand();
    const lead = await createLead();
    await store.upsertStateEligibility({ brand_id: brand.id, state_code: "TX", status: "approved" });
    const territory = await store.createTerritoryDefinition({
      brand_id: brand.id,
      territory_name: "Sold Territory",
      definition_type: "zip_list",
      status: "sold",
    });
    await store.addTerritoryZipCodes(territory.id, ["10001", "10002"]);

    const result = await evaluateTerritory({ brandId: brand.id, query: "10001", radiusMiles: 10, leadId: lead.id });
    expect(result.status).toBe("UNAVAILABLE");
    expect(result.evaluation.matchedTerritoryCount).toBe(1);
  });

  it("3. approved state + partial overlap → PARTIALLY_AVAILABLE", async () => {
    await seedZips();
    const brand = await createBrand();
    const lead = await createLead();
    await store.upsertStateEligibility({ brand_id: brand.id, state_code: "TX", status: "approved" });
    const territory = await store.createTerritoryDefinition({
      brand_id: brand.id,
      territory_name: "Partial Territory",
      definition_type: "zip_list",
      status: "sold",
    });
    // Only the outlying ZIP (10003) is sold — searching the city center should be "partial", not exact.
    await store.addTerritoryZipCodes(territory.id, ["10003"]);

    const result = await evaluateTerritory({ brandId: brand.id, query: "Centerville, TX", radiusMiles: 25, leadId: lead.id });
    expect(result.status).toBe("PARTIALLY_AVAILABLE");
  });

  it("4. restricted state → STATE_RESTRICTED", async () => {
    await seedZips();
    const brand = await createBrand();
    const lead = await createLead();
    await store.upsertStateEligibility({ brand_id: brand.id, state_code: "TX", status: "restricted" });

    const result = await evaluateTerritory({ brandId: brand.id, query: "10001", radiusMiles: 10, leadId: lead.id });
    expect(result.status).toBe("STATE_RESTRICTED");
  });

  it("5. missing state configuration → MANUAL_REVIEW (never AVAILABLE)", async () => {
    // createBrand now seeds every real US state's eligibility by default
    // (see lib/territory/defaultStateEligibility.ts), so a genuinely
    // *unconfigured* state has to be one outside that default set — "ZZ"
    // is not a real state code and will never get a seeded row, which is
    // exactly the "missing configuration" precondition this test needs.
    await seedZips("ZZ");
    const brand = await createBrand();
    const lead = await createLead();
    // No brand_state_eligibility row for ZZ at all.

    const result = await evaluateTerritory({ brandId: brand.id, query: "10001", radiusMiles: 10, leadId: lead.id });
    expect(result.status).toBe("MANUAL_REVIEW");
    expect(result.requiresManualReview).toBe(true);
  });

  it("6. missing brand configuration → BRAND_NOT_CONFIGURED", async () => {
    const lead = await createLead();
    const result = await evaluateTerritory({ brandId: "nonexistent-brand-id", query: "10001", radiusMiles: 10, leadId: lead.id });
    expect(result.status).toBe("BRAND_NOT_CONFIGURED");
  });

  it("7. exact ZIP search resolves the searched ZIP", async () => {
    await seedZips();
    const brand = await createBrand();
    const lead = await createLead();
    await store.upsertStateEligibility({ brand_id: brand.id, state_code: "TX", status: "approved" });

    const result = await evaluateTerritory({ brandId: brand.id, query: "10002", radiusMiles: 10, leadId: lead.id });
    expect(result.location.zipCode).toBe("10002");
    expect(result.location.stateCode).toBe("TX");
  });

  it("8. city search resolves to a city-level candidate", async () => {
    await seedZips();
    const brand = await createBrand();
    const lead = await createLead();
    await store.upsertStateEligibility({ brand_id: brand.id, state_code: "TX", status: "approved" });

    const result = await evaluateTerritory({ brandId: brand.id, query: "Centerville, TX", radiusMiles: 10, leadId: lead.id });
    expect(result.location.city).toBe("Centerville");
    expect(result.location.stateCode).toBe("TX");
  });

  it("9. radius calculation includes nearby ZIPs and excludes far-away ones", async () => {
    await seedZips();
    const brand = await createBrand();
    const lead = await createLead();
    await store.upsertStateEligibility({ brand_id: brand.id, state_code: "TX", status: "approved" });

    const narrow = await evaluateTerritory({ brandId: brand.id, query: "10001", radiusMiles: 5, leadId: lead.id });
    // 10002 is ~1.4mi away (within 5mi); 10003 is ~21mi away (outside 5mi, inside 25mi).
    expect(narrow.evaluation.zipCodes).toContain("10002");
    expect(narrow.evaluation.zipCodes).not.toContain("10003");

    const wide = await evaluateTerritory({ brandId: brand.id, query: "10001", radiusMiles: 25, leadId: lead.id });
    expect(wide.evaluation.zipCodes).toContain("10003");
  });

  it("10. reserved territories are treated as unavailable during the reservation period", async () => {
    await seedZips();
    const brand = await createBrand();
    const lead = await createLead();
    await store.upsertStateEligibility({ brand_id: brand.id, state_code: "TX", status: "approved" });
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    const territory = await store.createTerritoryDefinition({
      brand_id: brand.id,
      territory_name: "Reserved Territory",
      definition_type: "zip_list",
      status: "reserved",
      reserved_until: futureDate.toISOString(),
    });
    await store.addTerritoryZipCodes(territory.id, ["10001"]);

    const result = await evaluateTerritory({ brandId: brand.id, query: "10001", radiusMiles: 10, leadId: lead.id });
    expect(result.status).toBe("UNAVAILABLE");
  });

  it("11. expired reservations do not remain unavailable", async () => {
    await seedZips();
    const brand = await createBrand();
    const lead = await createLead();
    await store.upsertStateEligibility({ brand_id: brand.id, state_code: "TX", status: "approved" });
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 30);
    const territory = await store.createTerritoryDefinition({
      brand_id: brand.id,
      territory_name: "Expired Reservation",
      definition_type: "zip_list",
      status: "reserved",
      reserved_until: pastDate.toISOString(),
    });
    await store.addTerritoryZipCodes(territory.id, ["10001"]);

    const result = await evaluateTerritory({ brandId: brand.id, query: "10001", radiusMiles: 10, leadId: lead.id });
    expect(result.status).toBe("AVAILABLE");
  });

  it("12. one prospect's searches are not returned for another prospect", async () => {
    await seedZips();
    const brand = await createBrand();
    const leadA = await createLead();
    const leadB = await createLead();
    await store.upsertStateEligibility({ brand_id: brand.id, state_code: "TX", status: "approved" });

    await evaluateTerritory({ brandId: brand.id, query: "10001", radiusMiles: 10, leadId: leadA.id });
    await evaluateTerritory({ brandId: brand.id, query: "10002", radiusMiles: 10, leadId: leadB.id });

    const searchesForA = await store.listTerritorySearchesForLead(leadA.id);
    const searchesForB = await store.listTerritorySearchesForLead(leadB.id);
    expect(searchesForA.every((s) => s.lead_id === leadA.id)).toBe(true);
    expect(searchesForB.some((s) => s.lead_id === leadA.id)).toBe(false);
  });

  it("13. only ADMIN staff pass the territory admin authorization gate", () => {
    expect(isAdmin({ role: "ADMIN" })).toBe(true);
    expect(isAdmin({ role: "ADVISOR" })).toBe(false);
  });

  it("14. confidential territory data never appears in the client-facing result", async () => {
    await seedZips();
    const brand = await createBrand();
    const lead = await createLead();
    await store.upsertStateEligibility({ brand_id: brand.id, state_code: "TX", status: "approved" });
    const secretNote = "SECRET-FRANCHISEE-NAME-Jane-Doe";
    const territory = await store.createTerritoryDefinition({
      brand_id: brand.id,
      territory_name: "Sold Territory",
      definition_type: "zip_list",
      status: "sold",
      internal_notes: secretNote,
      public_display_level: "hidden",
    });
    await store.addTerritoryZipCodes(territory.id, ["10001"]);

    const result = await evaluateTerritory({ brandId: brand.id, query: "10001", radiusMiles: 10, leadId: lead.id });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(secretNote);
    expect(serialized).not.toContain(territory.id);
  });

  it("15. manual-review request is saved even when the webhook fails", async () => {
    const brand = await createBrand();
    const lead = await createLead();
    const reviewRequest = await store.createTerritoryReviewRequest({
      lead_id: lead.id,
      brand_id: brand.id,
      prospect_message: "Please take a look",
    });
    expect(reviewRequest.id).toBeTruthy();

    const originalUrl = process.env.TERRITORY_REVIEW_WEBHOOK_URL;
    process.env.TERRITORY_REVIEW_WEBHOOK_URL = "http://127.0.0.1:1/unreachable";
    try {
      const dispatch = await dispatchTerritoryReviewWebhook(lead, brand.id, reviewRequest, "Test City, TX", "AVAILABLE");
      expect(dispatch.ok).toBe(false);
    } finally {
      process.env.TERRITORY_REVIEW_WEBHOOK_URL = originalUrl;
    }

    // The stored record is unaffected by the webhook outcome.
    const stored = await store.getTerritoryReviewRequest(reviewRequest.id);
    expect(stored?.id).toBe(reviewRequest.id);
  });

  it("16. an unrecognized location returns LOCATION_NOT_FOUND, not an error", async () => {
    await seedZips();
    const brand = await createBrand();
    const lead = await createLead();
    await store.upsertStateEligibility({ brand_id: brand.id, state_code: "TX", status: "approved" });

    const result = await evaluateTerritory({ brandId: brand.id, query: "Nowhereville, ZZ", radiusMiles: 10, leadId: lead.id });
    expect(result.status).toBe("LOCATION_NOT_FOUND");
  });

  it("17. suggested alternatives exclude the conflicting ZIP itself", async () => {
    await seedZips();
    const brand = await createBrand();
    const lead = await createLead();
    await store.upsertStateEligibility({ brand_id: brand.id, state_code: "TX", status: "approved" });
    const territory = await store.createTerritoryDefinition({
      brand_id: brand.id,
      territory_name: "Sold Territory",
      definition_type: "zip_list",
      status: "sold",
    });
    await store.addTerritoryZipCodes(territory.id, ["10001"]);

    const result = await evaluateTerritory({ brandId: brand.id, query: "10001", radiusMiles: 10, leadId: lead.id });
    expect(result.status).toBe("UNAVAILABLE");
    expect(result.alternatives.every((a) => a.zipCode !== "10001")).toBe(true);
  });

  it("resolveFollowUp reuses the last radius when a follow-up only changes location", async () => {
    await seedZips();
    const brand = await createBrand();
    const lead = await createLead();
    await store.upsertStateEligibility({ brand_id: brand.id, state_code: "TX", status: "approved" });
    const first = await evaluateTerritory({ brandId: brand.id, query: "10001", radiusMiles: 15, leadId: lead.id });

    const resolved = await resolveFollowUp("Check 10002 instead", first);
    expect("query" in resolved && resolved.query).toContain("10002");
    expect("radiusMiles" in resolved && resolved.radiusMiles).toBe(15);
  });

  it("full prospect journey: search → view result → request review (closest equivalent to an e2e test — no browser test runner is configured in this repo)", async () => {
    await seedZips();
    const brand = await createBrand();
    const lead = await createLead();
    await store.upsertStateEligibility({ brand_id: brand.id, state_code: "TX", status: "approved" });

    // 1. Prospect opens Territory Advisor and searches a market.
    const result = await evaluateTerritory({ brandId: brand.id, query: "10001", radiusMiles: 10, leadId: lead.id });
    expect(result.status).toBe("AVAILABLE");
    expect(result.searchId).toBeTruthy();

    // 2. The map/result data the page would render is fully populated.
    expect(result.location.latitude).not.toBeNull();
    expect(result.location.longitude).not.toBeNull();

    // 3. Prospect requests a detailed review.
    const reviewRequest = await store.createTerritoryReviewRequest({
      lead_id: lead.id,
      brand_id: brand.id,
      territory_search_id: result.searchId,
      prospect_message: "Interested in this market",
    });
    expect(reviewRequest.status).toBe("new");

    // 4. It shows up in the admin queue (success state confirmed for the prospect).
    const queue = await store.listTerritoryReviewRequests();
    expect(queue.some((r) => r.id === reviewRequest.id)).toBe(true);
  });
});

describe("deleteTerritoryDefinition", () => {
  it("removes the territory and, unlike archiving, its ZIP codes too — a real hard delete", async () => {
    const brand = await createBrand();
    const territory = await store.createTerritoryDefinition({
      brand_id: brand.id,
      territory_name: "Delete Me",
      definition_type: "zip_list",
      status: "sold",
    });
    await store.addTerritoryZipCodes(territory.id, ["10001", "10002"]);
    expect(await store.listZipCodesForTerritory(territory.id)).toHaveLength(2);

    await store.deleteTerritoryDefinition(territory.id);

    expect(await store.getTerritoryDefinition(territory.id)).toBeNull();
    expect(await store.listZipCodesForTerritory(territory.id)).toHaveLength(0);
    const remaining = await store.listTerritoryDefinitions(brand.id);
    expect(remaining.some((t) => t.id === territory.id)).toBe(false);
  });

  it("deleting one territory never touches another's ZIP codes", async () => {
    const brand = await createBrand();
    const keep = await store.createTerritoryDefinition({
      brand_id: brand.id,
      territory_name: "Keep Me",
      definition_type: "zip_list",
      status: "sold",
    });
    const remove = await store.createTerritoryDefinition({
      brand_id: brand.id,
      territory_name: "Remove Me",
      definition_type: "zip_list",
      status: "sold",
    });
    await store.addTerritoryZipCodes(keep.id, ["10001"]);
    await store.addTerritoryZipCodes(remove.id, ["10002"]);

    await store.deleteTerritoryDefinition(remove.id);

    expect(await store.getTerritoryDefinition(keep.id)).not.toBeNull();
    expect(await store.listZipCodesForTerritory(keep.id)).toHaveLength(1);
  });

  it("deleting a nonexistent territory is a safe no-op", async () => {
    await expect(store.deleteTerritoryDefinition("does-not-exist")).resolves.toBeUndefined();
  });
});
