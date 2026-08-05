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

const BATCH_SIZE = 500;

async function main() {
  const dryRun = process.argv.includes("--dry");

  const { downloadAndParseZipData, ZIP_DATA_SOURCE_URL } = await import(
    "../lib/geocoding/zipImport"
  );
  console.log(`Downloading ${ZIP_DATA_SOURCE_URL} …`);
  const rows = await downloadAndParseZipData();
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

  let written = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
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
