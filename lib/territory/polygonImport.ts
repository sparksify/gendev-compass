import { simplifyGeometry, vertexCount, type GeoJsonAreaGeometry } from "@/lib/geo/simplify";
import type { UpsertZipGeographyInput } from "@/types/territory";

/**
 * Per-state ZCTA boundary import (US Census 2010 ZCTAs via the OpenDataDE
 * GeoJSON mirror). Download, parse, and simplification all happen in the
 * calling Node/serverless process — the database only receives batched
 * upserts of display-grade geometries (docs/territory-advisor.md,
 * "Nationwide ZIP data pipeline" hard rule).
 */

export const POLYGON_SOURCE_VERSION = "census-zcta-2010/opendatade";

/** USPS state code → OpenDataDE file slug. */
const STATE_FILE_SLUGS: Record<string, string> = {
  AL: "al_alabama", AK: "ak_alaska", AZ: "az_arizona", AR: "ar_arkansas",
  CA: "ca_california", CO: "co_colorado", CT: "ct_connecticut",
  DE: "de_delaware", DC: "dc_district_of_columbia", FL: "fl_florida",
  GA: "ga_georgia", HI: "hi_hawaii", ID: "id_idaho", IL: "il_illinois",
  IN: "in_indiana", IA: "ia_iowa", KS: "ks_kansas", KY: "ky_kentucky",
  LA: "la_louisiana", ME: "me_maine", MD: "md_maryland",
  MA: "ma_massachusetts", MI: "mi_michigan", MN: "mn_minnesota",
  MS: "ms_mississippi", MO: "mo_missouri", MT: "mt_montana",
  NE: "ne_nebraska", NV: "nv_nevada", NH: "nh_new_hampshire",
  NJ: "nj_new_jersey", NM: "nm_new_mexico", NY: "ny_new_york",
  NC: "nc_north_carolina", ND: "nd_north_dakota", OH: "oh_ohio",
  OK: "ok_oklahoma", OR: "or_oregon", PA: "pa_pennsylvania",
  RI: "ri_rhode_island", SC: "sc_south_carolina", SD: "sd_south_dakota",
  TN: "tn_tennessee", TX: "tx_texas", UT: "ut_utah", VT: "vt_vermont",
  VA: "va_virginia", WA: "wa_washington", WV: "wv_west_virginia",
  WI: "wi_wisconsin", WY: "wy_wyoming",
};

export const SUPPORTED_POLYGON_STATES = Object.keys(STATE_FILE_SLUGS);

/**
 * Operating states to backfill automatically (see the polygon backfill cron
 * job, app/api/cron/backfill-polygons/route.ts). Configurable via
 * TERRITORY_POLYGON_STATES (comma-separated USPS codes) so a deployment can
 * target its own operating footprint; defaults to the states the admin
 * panel's manual buttons cover today.
 */
export function targetPolygonStates(): string[] {
  const configured = process.env.TERRITORY_POLYGON_STATES;
  const states = configured
    ? configured.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean)
    : ["TX", "TN", "FL", "CA", "IL", "NY"];
  return states.filter((s) => SUPPORTED_POLYGON_STATES.includes(s));
}

/**
 * Picks the first target state with no boundary coverage yet — pure and
 * testable independent of the store. Returns null once every target state
 * is covered (the cron becomes a fast no-op from then on).
 */
export function pickNextPolygonState(targetStates: string[], coveredStates: Set<string>): string | null {
  return targetStates.find((state) => !coveredStates.has(state)) ?? null;
}

export function polygonSourceUrl(stateCode: string): string {
  const slug = STATE_FILE_SLUGS[stateCode];
  if (!slug) throw new Error(`No ZCTA boundary source for state ${stateCode}`);
  return `https://raw.githubusercontent.com/OpenDataDE/State-zip-code-GeoJSON/master/${slug}_zip_codes_geo.min.json`;
}

interface ZctaFeature {
  properties?: { ZCTA5CE10?: string; INTPTLAT10?: string; INTPTLON10?: string };
  geometry?: { type?: string; coordinates?: unknown };
}

/**
 * Downloads and prepares one state's ZCTA polygons: simplified GeoJSON per
 * ZIP, ready for store upsert. Throws on download/parse failure.
 */
/**
 * Well under any reasonable function `maxDuration` (see the same-shaped bug
 * fixed in lib/geocoding/censusImport.ts — a fetch timeout longer than the
 * route's own execution budget lets the platform kill the function first
 * and return an HTML error page instead of a JSON one).
 */
const FETCH_TIMEOUT_MS = 45_000;

export async function downloadStatePolygons(
  stateCode: string,
): Promise<UpsertZipGeographyInput[]> {
  const url = polygonSourceUrl(stateCode);
  const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!response.ok) {
    throw new Error(`ZCTA download for ${stateCode} failed: HTTP ${response.status}`);
  }
  const collection = (await response.json()) as { features?: ZctaFeature[] };
  const rows: UpsertZipGeographyInput[] = [];

  for (const feature of collection.features ?? []) {
    const zip = feature.properties?.ZCTA5CE10;
    const geometry = feature.geometry as GeoJsonAreaGeometry | undefined;
    if (!zip || !/^\d{5}$/.test(zip)) continue;
    if (!geometry || (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon")) continue;

    const latitude = Number(feature.properties?.INTPTLAT10);
    const longitude = Number(feature.properties?.INTPTLON10);
    const simplified = simplifyGeometry(geometry);
    // Safety valve: skip pathological geometries that stay enormous even
    // after simplification (none observed in ZCTA data; guard anyway).
    if (vertexCount(simplified) > 20_000) continue;

    rows.push({
      zip_code: zip,
      state_code: stateCode,
      latitude: Number.isFinite(latitude) ? latitude : 0,
      longitude: Number.isFinite(longitude) ? longitude : 0,
      geojson: simplified as unknown as Record<string, unknown>,
      geometry_source: polygonSourceUrl(stateCode),
      geometry_version: POLYGON_SOURCE_VERSION,
    });
  }
  return rows;
}

export interface RefreshStatePolygonsResult {
  state: string;
  written: number;
}

/**
 * The full refresh for one state: download, simplify, and batched upsert.
 * Shared by the admin-triggered route and the polygon backfill cron so both
 * go through identical logic.
 */
export async function refreshStatePolygons(stateCode: string): Promise<RefreshStatePolygonsResult> {
  const rows = await downloadStatePolygons(stateCode);
  // Imported lazily so merely importing the pure download/state-list
  // helpers above never has the side effect of binding the store
  // singleton (see the store's cwd-at-first-import binding in
  // lib/store/devStore.ts).
  const { getStore } = await import("@/lib/store");
  const store = getStore();
  const BATCH = 200;
  let written = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    await store.upsertZipGeographies(rows.slice(i, i + BATCH));
    written += Math.min(BATCH, rows.length - i);
  }
  return { state: stateCode, written };
}
