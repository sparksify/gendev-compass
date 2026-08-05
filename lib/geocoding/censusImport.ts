/**
 * Real ZIP-level demographics from the U.S. Census Bureau's public ACS
 * (American Community Survey) 5-Year API. Runs entirely in the Node
 * process — the database never does download or parse work (see
 * docs/territory-advisor.md, "Nationwide ZIP data pipeline").
 *
 * Variables (ACS 5-Year detailed tables, ZCTA level):
 *   B01003_001E  total population
 *   B11001_001E  total households
 *   B19013_001E  median household income (dollars)
 *
 * Growth is computed by comparing total population across two vintages.
 * ZCTA definitions changed between the 2010 and 2020 Censuses, so ZCTAs
 * missing from either vintage simply carry a null growth figure.
 *
 * The query is scoped per state (`&in=state:{fips}`) rather than one
 * nationwide wildcard call: a single request for all ~33,791 ZCTAs was
 * observed in production to come back silently truncated (an intermediary
 * between us and census.gov appears to cut off very large long-running
 * responses) — 51 small per-state requests are each fast and reliable, and
 * one state failing doesn't lose the other 50.
 */
import { US_STATES } from "./states";

export const CENSUS_API_BASE = process.env.CENSUS_API_BASE ?? "https://api.census.gov/data";

/** Latest ACS 5-Year vintage to load. 2023 covers the 2019–2023 window. */
export const CENSUS_CURRENT_VINTAGE = 2023;
/** Prior vintage used for the 5-year growth comparison. */
export const CENSUS_PRIOR_VINTAGE = 2018;

export const CENSUS_SOURCE_LABEL = "U.S. Census Bureau, ACS 5-Year";

/** USPS state code → 2-digit Census FIPS code, for `in=state:{fips}` scoping. */
export const STATE_FIPS_CODES: Record<string, string> = {
  AL: "01", AK: "02", AZ: "04", AR: "05", CA: "06", CO: "08", CT: "09", DE: "10",
  DC: "11", FL: "12", GA: "13", HI: "15", ID: "16", IL: "17", IN: "18", IA: "19",
  KS: "20", KY: "21", LA: "22", ME: "23", MD: "24", MA: "25", MI: "26", MN: "27",
  MS: "28", MO: "29", MT: "30", NE: "31", NV: "32", NH: "33", NJ: "34", NM: "35",
  NY: "36", NC: "37", ND: "38", OH: "39", OK: "40", OR: "41", PA: "42", RI: "44",
  SC: "45", SD: "46", TN: "47", TX: "48", UT: "49", VT: "50", VA: "51", WA: "53",
  WV: "54", WI: "55", WY: "56",
};

export interface ZipDemographics {
  population: number | null;
  households: number | null;
  medianHouseholdIncome: number | null;
  populationGrowthPct: number | null;
}

/** ACS uses large negative sentinels (e.g. -666666666) for suppressed values. */
function acsNumber(raw: unknown, { allowZero = true } = {}): number | null {
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) return null;
  if (!allowZero && value === 0) return null;
  return value;
}

/**
 * Parses an ACS API response (array-of-arrays with a header row) into a map
 * keyed by ZCTA. `variables` names the expected data columns in order; the
 * ZCTA code is read from the "zip code tabulation area" column.
 */
export function parseAcsResponse(
  rows: unknown[][],
  variables: string[],
): Map<string, Record<string, number | null>> {
  const result = new Map<string, Record<string, number | null>>();
  if (!Array.isArray(rows) || rows.length < 2) return result;
  const header = rows[0].map(String);
  const zctaIndex = header.indexOf("zip code tabulation area");
  if (zctaIndex === -1) throw new Error("ACS response missing the ZCTA column");
  const indices = variables.map((v) => {
    const index = header.indexOf(v);
    if (index === -1) throw new Error(`ACS response missing variable ${v}`);
    return index;
  });

  for (const row of rows.slice(1)) {
    const zcta = String(row[zctaIndex] ?? "");
    if (!/^\d{5}$/.test(zcta)) continue;
    const record: Record<string, number | null> = {};
    variables.forEach((variable, i) => {
      record[variable] = acsNumber(row[indices[i]], {
        // A $0 median income is a suppression artifact, not a real figure.
        allowZero: variable !== "B19013_001E",
      });
    });
    result.set(zcta, record);
  }
  return result;
}

/**
 * Well under any reasonable function `maxDuration` so a slow/unresponsive
 * Census API produces a proper JSON error from our own catch block instead
 * of being killed by the platform's function timeout — which returns an
 * HTML error page that breaks `response.json()` on the client ("Unexpected
 * token '<'"). Small per-state requests normally resolve in 1–3s.
 */
export const FETCH_TIMEOUT_MS = 20_000;

/** How many state requests run at once — enough parallelism to finish 51
 *  states well inside a function's time budget without hammering the API. */
export const STATE_FETCH_CONCURRENCY = 8;

async function fetchAcsForState(
  vintage: number,
  variables: string[],
  fipsCode: string,
): Promise<Map<string, Record<string, number | null>>> {
  // Trimmed defensively — a stray trailing newline/space from copy-pasting
  // the key into Vercel's env var UI would otherwise silently corrupt the
  // query string, and encodeURIComponent guards against any character
  // that would otherwise need escaping.
  const key = process.env.CENSUS_API_KEY?.trim();
  const url =
    `${CENSUS_API_BASE}/${vintage}/acs/acs5?get=${variables.join(",")}` +
    `&for=zip%20code%20tabulation%20area:*&in=state:${fipsCode}` +
    (key ? `&key=${encodeURIComponent(key)}` : "");
  const response = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { "User-Agent": "GenDevCompass/1.0 (Territory Intelligence market data import)" },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const rows = (await response.json()) as unknown[][];
  return parseAcsResponse(rows, variables);
}

export interface FetchAcsNationalResult {
  demographics: Map<string, Record<string, number | null>>;
  /** USPS codes for any state whose request failed — reported, never silent. */
  failedStates: string[];
}

/**
 * Fetches one ACS vintage across every state with bounded concurrency and
 * merges the results into a single ZCTA-keyed map. A single state's failure
 * is caught and reported in `failedStates`, not allowed to void the other
 * 50 states' data.
 */
export async function fetchAcsNational(vintage: number, variables: string[]): Promise<FetchAcsNationalResult> {
  const demographics = new Map<string, Record<string, number | null>>();
  const failedStates: string[] = [];
  const queue = [...US_STATES];

  async function worker() {
    while (queue.length > 0) {
      const state = queue.shift();
      if (!state) return;
      const fips = STATE_FIPS_CODES[state.code];
      if (!fips) continue;
      try {
        const stateMap = await fetchAcsForState(vintage, variables, fips);
        for (const [zcta, values] of stateMap) demographics.set(zcta, values);
      } catch (error) {
        console.error(`[census] ${state.code} (vintage ${vintage}) failed:`, error);
        failedStates.push(state.code);
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(STATE_FETCH_CONCURRENCY, US_STATES.length) }, worker),
  );
  return { demographics, failedStates };
}

/** Combines current-vintage levels with prior-vintage population into growth. */
export function buildDemographics(
  current: Map<string, Record<string, number | null>>,
  prior: Map<string, Record<string, number | null>>,
): Map<string, ZipDemographics> {
  const result = new Map<string, ZipDemographics>();
  for (const [zcta, values] of current) {
    const population = values["B01003_001E"] ?? null;
    const priorPopulation = prior.get(zcta)?.["B01003_001E"] ?? null;
    let populationGrowthPct: number | null = null;
    if (population != null && priorPopulation != null && priorPopulation > 0) {
      populationGrowthPct = Math.round(((population - priorPopulation) / priorPopulation) * 1000) / 10;
    }
    result.set(zcta, {
      population,
      households: values["B11001_001E"] ?? null,
      medianHouseholdIncome: values["B19013_001E"] ?? null,
      populationGrowthPct,
    });
  }
  return result;
}

export async function downloadCensusDemographics(): Promise<{
  demographics: Map<string, ZipDemographics>;
  vintageLabel: string;
  /** Any states that failed on either vintage — surfaced, never silent. */
  failedStates: string[];
}> {
  const [current, prior] = await Promise.all([
    fetchAcsNational(CENSUS_CURRENT_VINTAGE, ["B01003_001E", "B11001_001E", "B19013_001E"]),
    fetchAcsNational(CENSUS_PRIOR_VINTAGE, ["B01003_001E"]),
  ]);
  const failedStates = [...new Set([...current.failedStates, ...prior.failedStates])].sort();
  return {
    demographics: buildDemographics(current.demographics, prior.demographics),
    vintageLabel: `${CENSUS_CURRENT_VINTAGE - 4}-${CENSUS_CURRENT_VINTAGE}`,
    failedStates,
  };
}

/** Runs upserts with limited concurrency instead of one full sequential loop. */
async function upsertConcurrently<Row extends { zip_code: string }>(
  rows: Row[],
  upsert: (batch: Row[]) => Promise<void>,
  batchSize: number,
  concurrency: number,
): Promise<void> {
  const batches: Row[][] = [];
  for (let i = 0; i < rows.length; i += batchSize) batches.push(rows.slice(i, i + batchSize));

  let next = 0;
  async function worker() {
    while (next < batches.length) {
      const batch = batches[next++];
      await upsert(batch);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, batches.length) }, worker));
}

export interface RefreshDemographicsResult {
  source: string;
  vintage: string;
  existingZips: number;
  withDemographics: number;
  written: number;
  failedStates: string[];
}

/**
 * The full refresh: reads the already-loaded ZIP reference from our own
 * store (no external GeoNames re-download — see buildDemographicsUpsertRows
 * for why that's safe), fetches Census ACS demographics per state, and
 * writes only the ZIPs that matched, concurrently in batches. Shared by the
 * admin-triggered route and the scheduled cron job so both go through
 * identical logic.
 *
 * Throws (with a clear message) if no ZIP reference has been loaded yet —
 * callers should run refreshZipReference() first.
 */
export async function refreshDemographics(): Promise<RefreshDemographicsResult> {
  // Imported lazily so merely importing the pure parsing/fetch helpers
  // above never has the side effect of binding the store singleton (see
  // the store's cwd-at-first-import binding in lib/store/devStore.ts).
  const { getStore } = await import("@/lib/store");
  const store = getStore();
  const [existingRows, census] = await Promise.all([
    store.listZipCodeReferences(),
    downloadCensusDemographics(),
  ]);

  if (existingRows.length === 0) {
    throw new Error('No ZIP reference data loaded yet — run the ZIP reference refresh first.');
  }

  const rows = buildDemographicsUpsertRows(existingRows, census, new Date().toISOString());
  await upsertConcurrently(rows, (batch) => store.upsertZipCodeReferences(batch), 1000, 4);

  return {
    source: CENSUS_SOURCE_LABEL,
    vintage: census.vintageLabel,
    existingZips: existingRows.length,
    withDemographics: rows.length,
    written: rows.length,
    failedStates: census.failedStates,
  };
}

/** Current ACS 5-Year vintage label, e.g. "2019-2023" — also used to detect
 *  which states already have up-to-date demographics (see
 *  coveredDemographicsStates). */
export const DEMOGRAPHICS_VINTAGE_LABEL = `${CENSUS_CURRENT_VINTAGE - 4}-${CENSUS_CURRENT_VINTAGE}`;

/**
 * A state counts as covered once at least this fraction of its existing
 * ZIP rows carry the current vintage. Not 100% — plenty of GeoNames ZIP
 * entries (PO boxes, unique large-employer ZIPs) simply have no Census
 * ZCTA match — but high enough that a handful of leftover rows from an
 * old, incomplete import (e.g. 19 of TX's 2,600 ZIPs, a real value seen in
 * production before this threshold existed) can never again masquerade as
 * "done" and get skipped forever.
 */
const COVERAGE_RATIO_THRESHOLD = 0.2;

/** State codes whose ZIPs already carry demographics for the current
 *  vintage, above COVERAGE_RATIO_THRESHOLD — used to skip already-covered
 *  states on a re-run/retry. */
export function coveredDemographicsStates(
  rows: Array<{ state_code: string; demographics_vintage: string | null }>,
): Set<string> {
  const totalByState = new Map<string, number>();
  const currentByState = new Map<string, number>();
  for (const row of rows) {
    totalByState.set(row.state_code, (totalByState.get(row.state_code) ?? 0) + 1);
    if (row.demographics_vintage === DEMOGRAPHICS_VINTAGE_LABEL) {
      currentByState.set(row.state_code, (currentByState.get(row.state_code) ?? 0) + 1);
    }
  }
  const covered = new Set<string>();
  for (const [state, total] of totalByState) {
    const current = currentByState.get(state) ?? 0;
    if (total > 0 && current / total >= COVERAGE_RATIO_THRESHOLD) covered.add(state);
  }
  return covered;
}

export interface SyncDemographicsResult {
  /** States successfully fetched and written during this invocation. */
  loadedStates: string[];
  written: number;
  /** Target states still needing demographics — budget-cut or failed this
   *  pass, either way retried automatically on the next call. */
  remainingStates: string[];
  /** States whose fetch failed this pass (a subset of remainingStates) —
   *  surfaced, never silent. */
  failedStates: string[];
  /** state → error message, for whichever states in failedStates failed
   *  this pass — the actual cause (timeout, HTTP 403, etc.), not just the
   *  state code, so a stuck sync is diagnosable from the admin UI alone. */
  failedStateErrors: Record<string, string>;
  vintage: string;
  existingZips: number;
}

/**
 * Loads Census demographics one state at a time (bounded concurrency),
 * writing each state's rows to the store as soon as they're ready instead
 * of batching every state's data together and writing once at the very
 * end. This matters because a single invocation is capped by the
 * platform's function duration: fetching all 51 states nationwide before
 * writing anything risks the platform killing the function partway
 * through and silently discarding everything that hadn't been written
 * yet — the same failure shape as the single-wildcard-request truncation
 * this module's docstring describes, just at the invocation level instead
 * of the request level (and the likely reason the "Load Census
 * Demographics" button could be clicked repeatedly without nationwide
 * coverage ever accumulating — each run's writes replaced the last
 * instead of building on it).
 *
 * Callers re-invoke while `remainingStates` is non-empty, exactly like
 * lib/territory/polygonImport.ts's syncPolygons for boundary shapes: the
 * admin UI auto-repeats and the weekly cron picks up any remainder on its
 * next scheduled run.
 */
export async function syncDemographics(budgetMs: number): Promise<SyncDemographicsResult> {
  const { getStore } = await import("@/lib/store");
  const store = getStore();
  const existingRows = await store.listZipCodeReferences();
  if (existingRows.length === 0) {
    throw new Error('No ZIP reference data loaded yet — run the ZIP reference refresh first.');
  }

  const byState = new Map<string, typeof existingRows>();
  for (const row of existingRows) {
    const list = byState.get(row.state_code);
    if (list) list.push(row);
    else byState.set(row.state_code, [row]);
  }

  const covered = coveredDemographicsStates(existingRows);
  const queue = Object.keys(STATE_FIPS_CODES).filter((state) => !covered.has(state));

  const startedAt = Date.now();
  const loadedStates: string[] = [];
  const failedStates: string[] = [];
  const failedStateErrors: Record<string, string> = {};
  let written = 0;

  async function worker() {
    while (queue.length > 0 && Date.now() - startedAt < budgetMs) {
      const stateCode = queue.shift();
      if (!stateCode) return;
      const fips = STATE_FIPS_CODES[stateCode];
      try {
        // The current-vintage fetch (population/households/income) is
        // required; the prior-vintage fetch (growth comparison only) is
        // decoupled and allowed to fail on its own — a state-scoped ZCTA
        // query against an older vintage failing (observed in production:
        // every state's prior-vintage request rejected with HTTP 400,
        // predating when the Census API's ZCTA-by-state support was
        // introduced) must never discard population/income data that
        // fetched successfully. Growth simply stays null for that state.
        const current = await fetchAcsForState(
          CENSUS_CURRENT_VINTAGE,
          ["B01003_001E", "B11001_001E", "B19013_001E"],
          fips,
        );
        let prior = new Map<string, Record<string, number | null>>();
        try {
          prior = await fetchAcsForState(CENSUS_PRIOR_VINTAGE, ["B01003_001E"], fips);
        } catch (priorError) {
          console.error(`[census] ${stateCode} prior-vintage (growth) fetch failed — proceeding without growth:`, priorError);
        }
        const demographics = buildDemographics(current, prior);
        const rows = buildDemographicsUpsertRows(
          byState.get(stateCode) ?? [],
          { demographics, vintageLabel: DEMOGRAPHICS_VINTAGE_LABEL },
          new Date().toISOString(),
        );
        const BATCH = 1000;
        for (let i = 0; i < rows.length; i += BATCH) {
          await store.upsertZipCodeReferences(rows.slice(i, i + BATCH));
        }
        written += rows.length;
        loadedStates.push(stateCode);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[census] ${stateCode} sync failed:`, error);
        failedStates.push(stateCode);
        failedStateErrors[stateCode] = message;
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(STATE_FETCH_CONCURRENCY, queue.length) }, worker));

  return {
    loadedStates,
    written,
    // Union of never-started (still queued when the budget ran out) and
    // failed-this-pass states — both need another call to complete.
    remainingStates: [...queue, ...failedStates],
    failedStates,
    failedStateErrors,
    vintage: DEMOGRAPHICS_VINTAGE_LABEL,
    existingZips: existingRows.length,
  };
}

/**
 * Merges Census figures onto already-loaded ZIP reference rows — no
 * external GeoNames re-download needed, since those rows already satisfy
 * zip_code_reference's NOT NULL constraints (city/state/lat/lng). Only ZIPs
 * that actually matched Census data are returned; everything else is left
 * untouched (fewer, cheaper writes than a full re-upsert of every row).
 */
export function buildDemographicsUpsertRows<
  Row extends {
    zip_code: string;
    city: string;
    state_code: string;
    county_name: string | null;
    latitude: number;
    longitude: number;
    timezone: string | null;
    created_at: string;
  },
>(
  existingRows: Row[],
  census: { demographics: Map<string, ZipDemographics>; vintageLabel: string },
  now: string,
): Array<
  Pick<Row, "zip_code" | "city" | "state_code" | "county_name" | "latitude" | "longitude" | "timezone" | "created_at"> & {
    updated_at: string;
    population: number | null;
    households: number | null;
    median_household_income: number | null;
    population_growth_pct: number | null;
    demographics_source: string;
    demographics_vintage: string;
  }
> {
  const rows = [];
  for (const row of existingRows) {
    const demo = census.demographics.get(row.zip_code);
    if (!demo) continue;
    rows.push({
      zip_code: row.zip_code,
      city: row.city,
      state_code: row.state_code,
      county_name: row.county_name,
      latitude: row.latitude,
      longitude: row.longitude,
      timezone: row.timezone,
      created_at: row.created_at,
      updated_at: now,
      population: demo.population,
      households: demo.households,
      median_household_income: demo.medianHouseholdIncome,
      population_growth_pct: demo.populationGrowthPct,
      demographics_source: CENSUS_SOURCE_LABEL,
      demographics_vintage: census.vintageLabel,
    });
  }
  return rows;
}
