/**
 * Nationwide ZIP reference import for the Territory Advisor.
 *
 *   npm run import:zips             # load/refresh all ~41k US ZIPs
 *   npm run import:zips -- --dry    # parse + report only, write nothing
 *
 * Source: the GeoNames US postal-code dataset (CC BY 4.0,
 * https://www.geonames.org) via the symerio/postal-codes-data GitHub
 * mirror. Tab-separated: country, zip, place, state name, state code,
 * county name, county code, admin3 name, admin3 code, lat, lng, accuracy.
 *
 * THE RULE THIS SCRIPT EXISTS TO ENFORCE: bulk data work happens OUTSIDE
 * the database. The download and parsing run in this process; the database
 * only ever sees small batched upserts through the normal store layer.
 * (The first import attempt ran HTTP downloads + GeoJSON parsing inside
 * production Postgres and took the site down — never again.)
 *
 * Rerunnable: upserts by zip_code, replacing existing rows. Note that the
 * curated demo rows carried PLACEHOLDER population/household/income figures
 * (never real Census data — see lib/geocoding/seedZipData.ts); this import
 * intentionally replaces them with real GeoNames names/coordinates and null
 * demographics. Loading real Census demographics is future work; the app
 * renders gracefully without them.
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

const SOURCE_URL =
  process.env.ZIP_DATA_SOURCE_URL ??
  "https://raw.githubusercontent.com/symerio/postal-codes-data/master/data/geonames/US.txt";

const BATCH_SIZE = 500;

interface ParsedZip {
  zip_code: string;
  city: string;
  state_code: string;
  county_name: string | null;
  latitude: number;
  longitude: number;
}

function parseGeoNames(text: string): ParsedZip[] {
  const byZip = new Map<string, ParsedZip>();
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    const parts = line.split("\t");
    // country, zip, place, state name, state code, county name, ...
    const [country, zip, place, , stateCode, countyName] = parts;
    const latitude = Number(parts[9]);
    const longitude = Number(parts[10]);
    if (country !== "US") continue;
    if (!/^\d{5}$/.test(zip ?? "")) continue;
    if (!place || !stateCode || !/^[A-Z]{2}$/.test(stateCode)) continue;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
    // First entry wins per ZIP (the dataset lists the primary place first).
    if (!byZip.has(zip)) {
      byZip.set(zip, {
        zip_code: zip,
        city: place,
        state_code: stateCode,
        county_name: countyName?.trim() ? countyName.trim() : null,
        latitude,
        longitude,
      });
    }
  }
  return [...byZip.values()];
}

async function main() {
  const dryRun = process.argv.includes("--dry");

  console.log(`Downloading ${SOURCE_URL} …`);
  const response = await fetch(SOURCE_URL, { signal: AbortSignal.timeout(120_000) });
  if (!response.ok) {
    throw new Error(`Download failed: HTTP ${response.status}`);
  }
  const text = await response.text();
  const rows = parseGeoNames(text);
  const states = new Set(rows.map((r) => r.state_code));
  console.log(`Parsed ${rows.length} unique ZIP codes across ${states.size} states/territories.`);

  if (dryRun) {
    console.log("--dry: nothing written.");
    return;
  }

  // Imported after dotenv so the store sees the environment. Uses the same
  // store layer as the app (Supabase when configured, dev store otherwise).
  const { getStore } = await import("../lib/store");
  const store = getStore();

  const now = new Date().toISOString();
  let written = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE).map((r) => ({
      ...r,
      population: null,
      households: null,
      median_household_income: null,
      timezone: null,
      created_at: now,
      updated_at: now,
    }));
    await store.upsertZipCodeReferences(batch);
    written += batch.length;
    if (written % 5000 < BATCH_SIZE) {
      console.log(`  upserted ${written}/${rows.length}`);
    }
  }
  console.log(`Done: ${written} ZIP reference rows upserted.`);
}

main().catch((error) => {
  console.error("ZIP import failed:", error);
  process.exit(1);
});
