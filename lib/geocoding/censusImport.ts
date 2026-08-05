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
 */

export const CENSUS_API_BASE = process.env.CENSUS_API_BASE ?? "https://api.census.gov/data";

/** Latest ACS 5-Year vintage to load. 2023 covers the 2019–2023 window. */
export const CENSUS_CURRENT_VINTAGE = 2023;
/** Prior vintage used for the 5-year growth comparison. */
export const CENSUS_PRIOR_VINTAGE = 2018;

export const CENSUS_SOURCE_LABEL = "U.S. Census Bureau, ACS 5-Year";

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
 * Well under the route's `maxDuration` (60s) so a slow/unresponsive Census
 * API produces a proper JSON error from our own catch block instead of
 * being killed by the platform's function timeout — which returns an HTML
 * error page that breaks `response.json()` on the client ("Unexpected
 * token '<'"). Optional CENSUS_API_KEY (free, instant signup at
 * api.census.gov/data/key_signup.html) avoids the anonymous per-IP rate
 * limit that can make responses slow or unreliable.
 */
export const FETCH_TIMEOUT_MS = 35_000;

async function fetchAcs(vintage: number, variables: string[]): Promise<Map<string, Record<string, number | null>>> {
  const key = process.env.CENSUS_API_KEY;
  const url =
    `${CENSUS_API_BASE}/${vintage}/acs/acs5?get=${variables.join(",")}&for=zip%20code%20tabulation%20area:*` +
    (key ? `&key=${key}` : "");
  const response = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { "User-Agent": "GenDevCompass/1.0 (Territory Intelligence market data import)" },
  });
  if (!response.ok) {
    throw new Error(`Census ACS ${vintage} download failed: HTTP ${response.status}`);
  }
  const rows = (await response.json()) as unknown[][];
  return parseAcsResponse(rows, variables);
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
}> {
  const [current, prior] = await Promise.all([
    fetchAcs(CENSUS_CURRENT_VINTAGE, ["B01003_001E", "B11001_001E", "B19013_001E"]),
    fetchAcs(CENSUS_PRIOR_VINTAGE, ["B01003_001E"]),
  ]);
  return {
    demographics: buildDemographics(current, prior),
    vintageLabel: `${CENSUS_CURRENT_VINTAGE - 4}-${CENSUS_CURRENT_VINTAGE}`,
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
