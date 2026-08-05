import { simplifyGeometry, vertexCount, type GeoJsonAreaGeometry } from "@/lib/geo/simplify";
import type { UpsertZipGeographyInput } from "@/types/territory";

/**
 * ZCTA boundary preparation (US Census 2010 ZCTAs via the OpenDataDE
 * GeoJSON mirror). Parsing and simplification happen in the calling
 * Node/serverless process — the database only receives batched upserts of
 * display-grade geometries (docs/territory-advisor.md, "Nationwide ZIP
 * data pipeline" hard rule).
 *
 * At runtime the app never downloads boundary data: ZCTA shapes are
 * static between decennial Censuses, so all 50 states + DC are
 * pre-processed by scripts/build-zcta-bundle.ts and shipped INSIDE the
 * app (data/zcta/*.json.gz — see lib/territory/zctaBundle.ts). The
 * download path below exists for the build script and as a fallback for
 * a state missing from the bundle.
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
 * States whose boundary shapes the app should carry. Defaults to the whole
 * country (all 50 states + DC); TERRITORY_POLYGON_STATES (comma-separated
 * USPS codes) can narrow it for a deployment that wants a smaller footprint.
 */
export function targetPolygonStates(): string[] {
  const configured = process.env.TERRITORY_POLYGON_STATES;
  if (!configured) return [...SUPPORTED_POLYGON_STATES];
  return configured
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s) => SUPPORTED_POLYGON_STATES.includes(s));
}

/**
 * The target states not yet covered, in target order — pure and testable
 * independent of the store. Empty once everything is loaded (the cron and
 * the admin sync become fast no-ops from then on).
 */
export function pickUncoveredStates(targetStates: string[], coveredStates: Set<string>): string[] {
  return targetStates.filter((state) => !coveredStates.has(state));
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
 * Parses a raw OpenDataDE state FeatureCollection into simplified,
 * upsert-ready rows. Pure (no I/O) — shared by the runtime fallback
 * download and the offline bundle build script.
 */
export function parseStatePolygons(
  collection: { features?: ZctaFeature[] },
  stateCode: string,
): UpsertZipGeographyInput[] {
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

/**
 * Well under any reasonable function `maxDuration` (see the same-shaped bug
 * fixed in lib/geocoding/censusImport.ts — a fetch timeout longer than the
 * route's own execution budget lets the platform kill the function first
 * and return an HTML error page instead of a JSON one).
 */
const FETCH_TIMEOUT_MS = 45_000;

/**
 * Runtime fallback: downloads and prepares one state's ZCTA polygons.
 * Only used when a state is missing from the shipped bundle.
 */
export async function downloadStatePolygons(
  stateCode: string,
): Promise<UpsertZipGeographyInput[]> {
  const url = polygonSourceUrl(stateCode);
  const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!response.ok) {
    throw new Error(`ZCTA download for ${stateCode} failed: HTTP ${response.status}`);
  }
  const collection = (await response.json()) as { features?: ZctaFeature[] };
  return parseStatePolygons(collection, stateCode);
}

async function upsertRows(rows: UpsertZipGeographyInput[]): Promise<number> {
  // Imported lazily so merely importing the pure helpers in this module
  // never has the side effect of binding the store singleton (see the
  // store's cwd-at-first-import binding in lib/store/devStore.ts).
  const { getStore } = await import("@/lib/store");
  const store = getStore();
  const BATCH = 200;
  let written = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    await store.upsertZipGeographies(rows.slice(i, i + BATCH));
    written += Math.min(BATCH, rows.length - i);
  }
  return written;
}

export interface RefreshStatePolygonsResult {
  state: string;
  written: number;
  /** Where the rows came from: the shipped bundle or the network fallback. */
  source: "bundle" | "download";
}

/**
 * The full refresh for one state: bundled data when shipped (no network),
 * download fallback otherwise, then batched upsert. Shared by the admin
 * sync route and the polygon backfill cron so both go through identical
 * logic.
 */
export async function refreshStatePolygons(stateCode: string): Promise<RefreshStatePolygonsResult> {
  const { loadBundledStateRows } = await import("./zctaBundle");
  const bundled = loadBundledStateRows(stateCode);
  const rows = bundled ?? (await downloadStatePolygons(stateCode));
  const written = await upsertRows(rows);
  return { state: stateCode, written, source: bundled ? "bundle" : "download" };
}

export interface SyncPolygonsResult {
  /** States loaded during this invocation, in order. */
  loadedStates: string[];
  written: number;
  /** Target states still uncovered when the time budget ran out. */
  remainingStates: string[];
}

/**
 * Loads boundary shapes for every target state that has no coverage yet,
 * within a time budget that stays safely inside the route's maxDuration.
 * With bundled data each state takes a few seconds, so the whole country
 * typically completes in one or two invocations; callers re-invoke while
 * `remainingStates` is non-empty. Once covered, this is a fast no-op.
 */
export async function syncPolygons(budgetMs: number): Promise<SyncPolygonsResult> {
  const { getStore } = await import("@/lib/store");
  const store = getStore();
  const targets = targetPolygonStates();
  const coverage = await Promise.all(
    targets.map(async (state) => [state, await store.hasZipGeographiesForState(state)] as const),
  );
  const uncovered = pickUncoveredStates(
    targets,
    new Set(coverage.filter(([, has]) => has).map(([state]) => state)),
  );

  const startedAt = Date.now();
  const loadedStates: string[] = [];
  let written = 0;
  for (const state of uncovered) {
    if (Date.now() - startedAt > budgetMs) break;
    const result = await refreshStatePolygons(state);
    loadedStates.push(state);
    written += result.written;
  }

  return {
    loadedStates,
    written,
    remainingStates: uncovered.filter((state) => !loadedStates.includes(state)),
  };
}
