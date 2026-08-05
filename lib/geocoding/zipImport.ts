import type { ZipCodeReferenceRecord } from "@/types/territory";

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

export function parseGeoNames(text: string): ZipCodeReferenceRecord[] {
  const now = new Date().toISOString();
  const byZip = new Map<string, ZipCodeReferenceRecord>();
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
        // Real demographics are future work; the demo seed's figures were
        // placeholders and are intentionally replaced with nulls.
        population: null,
        households: null,
        median_household_income: null,
        timezone: null,
        created_at: now,
        updated_at: now,
      });
    }
  }
  return [...byZip.values()];
}

export async function downloadAndParseZipData(): Promise<ZipCodeReferenceRecord[]> {
  const response = await fetch(ZIP_DATA_SOURCE_URL, { signal: AbortSignal.timeout(120_000) });
  if (!response.ok) {
    throw new Error(`ZIP data download failed: HTTP ${response.status}`);
  }
  return parseGeoNames(await response.text());
}
