/**
 * Territory Advisor dev seed: zip-code reference data, the CMDT brand's
 * state eligibility and demo territories, plus a second, deliberately
 * unconfigured brand. Safe to re-run (idempotent upserts).
 *
 *   npm run seed:territory
 *
 * All records here are clearly-labeled development/demo data — never
 * insert this into a production database as real territory records.
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const { getStore } = await import("../lib/store");
  const { SEED_ZIP_CODES } = await import("../lib/geocoding/seedZipData");

  const store = getStore();
  const now = new Date();

  console.log(`Seeding ${SEED_ZIP_CODES.length} ZIP code reference rows...`);
  await store.upsertZipCodeReferences(
    SEED_ZIP_CODES.map((row) => ({ ...row, created_at: now.toISOString(), updated_at: now.toISOString() })),
  );

  // ---------------------------------------------------------------------
  // Primary brand: CMDT (matches lib/config/opportunity.ts's slug "cmdt").
  // ---------------------------------------------------------------------
  let cmdt = await store.getBrandBySlug("cmdt");
  if (!cmdt) {
    cmdt = await store.createBrand({ slug: "cmdt", name: "Complete Mobile Drug Testing", default_radius_miles: 10 });
    console.log("Created brand: cmdt");
  }

  const eligibilityRows: Array<{ state: string; status: "approved" | "pending" | "restricted" | "exempt" }> = [
    { state: "TX", status: "approved" },
    { state: "TN", status: "approved" },
    { state: "NY", status: "restricted" },
    { state: "IL", status: "restricted" },
    { state: "CA", status: "pending" },
    { state: "FL", status: "exempt" },
  ];
  for (const row of eligibilityRows) {
    await store.upsertStateEligibility({ brand_id: cmdt.id, state_code: row.state, status: row.status });
  }
  console.log(`Set state eligibility for ${eligibilityRows.length} states (AZ intentionally left unconfigured → MANUAL_REVIEW).`);

  const existingTerritories = await store.listTerritoryDefinitions(cmdt.id);

  // Sold ZIP-based territory: Dallas Uptown/Downtown.
  let dallasUptown = existingTerritories.find((t) => t.territory_code === "DAL-01");
  if (!dallasUptown) {
    dallasUptown = await store.createTerritoryDefinition({
      brand_id: cmdt.id,
      territory_name: "Dallas Uptown/Downtown",
      territory_code: "DAL-01",
      definition_type: "zip_list",
      status: "sold",
      public_display_level: "generalized",
      internal_notes: "Seed data — demo franchisee, not a real owner.",
      awarded_at: new Date(now.getFullYear() - 1, 3, 15).toISOString(),
    });
    await store.addTerritoryZipCodes(dallasUptown.id, ["75201", "75204"]);
    console.log("Created sold ZIP-based territory: Dallas Uptown/Downtown (DAL-01)");
  }

  // Reserved radius-based territory: Franklin, TN.
  let franklinReserved = existingTerritories.find((t) => t.territory_code === "TN-FRA-01");
  if (!franklinReserved) {
    const reservedUntil = new Date(now);
    reservedUntil.setDate(reservedUntil.getDate() + 90);
    franklinReserved = await store.createTerritoryDefinition({
      brand_id: cmdt.id,
      territory_name: "Franklin, TN Territory",
      territory_code: "TN-FRA-01",
      definition_type: "radius",
      status: "reserved",
      center_latitude: 35.9251,
      center_longitude: -86.9204,
      radius_miles: 8,
      public_display_level: "generalized",
      internal_notes: "Seed data — reservation hold for demo purposes.",
      reserved_until: reservedUntil.toISOString(),
    });
    console.log("Created reserved radius-based territory: Franklin, TN (TN-FRA-01)");
  }

  // Partially-overlapping market: only one of Plano's several ZIPs is sold,
  // so a 10-mile search centered on Plano returns PARTIALLY_AVAILABLE.
  let planoPartial = existingTerritories.find((t) => t.territory_code === "TX-PLA-01");
  if (!planoPartial) {
    planoPartial = await store.createTerritoryDefinition({
      brand_id: cmdt.id,
      territory_name: "Plano Central",
      territory_code: "TX-PLA-01",
      definition_type: "zip_list",
      status: "sold",
      public_display_level: "generalized",
      internal_notes: "Seed data — demonstrates partial overlap with a broader radius search.",
      awarded_at: new Date(now.getFullYear(), 0, 10).toISOString(),
    });
    await store.addTerritoryZipCodes(planoPartial.id, ["75074"]);
    console.log("Created partially-overlapping sold territory: Plano Central (TX-PLA-01)");
  }

  // ---------------------------------------------------------------------
  // Second brand: deliberately left unconfigured (no eligibility rows, no
  // territories) — every search under it resolves to MANUAL_REVIEW, never
  // AVAILABLE, demonstrating the "no silent default to available" rule.
  // ---------------------------------------------------------------------
  let unconfigured = await store.getBrandBySlug("demo-unconfigured");
  if (!unconfigured) {
    unconfigured = await store.createBrand({
      slug: "demo-unconfigured",
      name: "Demo Brand (Unconfigured)",
      default_radius_miles: 10,
    });
    console.log("Created deliberately-unconfigured brand: demo-unconfigured");
  }

  console.log("\nTerritory Advisor seed complete.");
  console.log("Try these in the portal's Territory Advisor once you have a demo lead (npm run seed):");
  console.log('  "Frisco, TX"        → AVAILABLE');
  console.log('  "Plano, TX"         → PARTIALLY_AVAILABLE (10 mi radius)');
  console.log('  "75201"             → UNAVAILABLE (sold)');
  console.log('  "Franklin, TN"      → UNAVAILABLE (reserved, within 8 mi)');
  console.log('  "New York, NY"      → STATE_RESTRICTED');
  console.log('  "Phoenix, AZ"       → MANUAL_REVIEW (state not configured)');
}

main().catch((error) => {
  console.error("Territory seed failed:", error);
  process.exit(1);
});
