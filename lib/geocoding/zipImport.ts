import type { UpsertZipCodeReferenceInput } from "@/types/territory";

/**
 * Shared GeoNames US postal-dataset download + parse, used by both the CLI
 * import (scripts/import-zip-data.ts) and the admin API route. Everything
 * here runs in the Node process — the database never does download or
 * parse work (docs/territory-advisor.md, "Nationwide ZIP data pipeline").
 *
 * Source: GeoNames postal codes (CC BY 4.0, https://www.geonames.org) via
 * the symerio/postal-codes-data GitHub mirror. Tab-separated columns:
 * country, zip, place, state name, state code, county name, county code,
 * admin3 name, admin3 code, lat, lng, accuracy.
 */

export const ZIP_DATA_SOURCE_URL =
  process.env.ZIP_DATA_SOURCE_URL ??
  "https://raw.githubusercontent.com/symerio/postal-codes-data/master/data/geonames/US.txt";

export function parseGeoNames(text: string): UpsertZipCodeReferenceInput[] {
  const now = new Date().toISOString();
  const byZip = new Map<string, UpsertZipCodeReferenceInput>();
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    const parts = line.split("\t");
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
        // Demographic keys are deliberately omitted: on update, existing
        // Census figures (loaded via /api/admin/import-demographics) are
        // left untouched.
        timezone: null,
        created_at: now,
        updated_at: now,
      });
    }
  }
  return [...byZip.values()];
}

/**
 * Well under any reasonable function `maxDuration` (see the same-shaped bug
 * fixed in lib/geocoding/censusImport.ts — a fetch timeout longer than the
 * route's own execution budget lets the platform kill the function first
 * and return an HTML error page instead of a JSON one).
 */
const FETCH_TIMEOUT_MS = 45_000;

export async function downloadAndParseZipData(): Promise<UpsertZipCodeReferenceInput[]> {
  const response = await fetch(ZIP_DATA_SOURCE_URL, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!response.ok) {
    throw new Error(`ZIP data download failed: HTTP ${response.status}`);
  }
  return parseGeoNames(await response.text());
}

export interface RefreshZipReferenceResult {
  source: string;
  parsed: number;
  written: number;
}

/**
 * The full refresh: download, parse, and batched upsert. Shared by the
 * admin-triggered route and the scheduled cron job so both go through
 * identical logic (docs/territory-advisor.md, "Nationwide ZIP data
 * pipeline").
 */
export async function refreshZipReference(): Promise<RefreshZipReferenceResult> {
  const rows = await downloadAndParseZipData();
  // Imported lazily so merely importing the pure download/parse helpers
  // above never has the side effect of binding the store singleton (see
  // the store's cwd-at-first-import binding in lib/store/devStore.ts).
  const { getStore } = await import("@/lib/store");
  const store = getStore();
  const BATCH = 1000;
  let written = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    await store.upsertZipCodeReferences(rows.slice(i, i + BATCH));
    written += Math.min(BATCH, rows.length - i);
  }
  return { source: ZIP_DATA_SOURCE_URL, parsed: rows.length, written };
}
