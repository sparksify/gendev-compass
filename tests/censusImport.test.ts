import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildDemographicsUpsertRows,
  CENSUS_SOURCE_LABEL,
  coveredDemographicsStates,
  DEMOGRAPHICS_VINTAGE_LABEL,
  downloadCensusDemographics,
  fetchAcsForState,
  fetchAcsNational,
  FETCH_TIMEOUT_MS,
  STATE_FETCH_CONCURRENCY,
  STATE_FIPS_CODES,
} from "@/lib/geocoding/censusImport";
import { US_STATES } from "@/lib/geocoding/states";

const REASONABLE_MAX_DURATION_S = 60; // matches app/api/admin/import-demographics/route.ts maxDuration

describe("STATE_FIPS_CODES", () => {
  it("has an entry for every state in US_STATES (50 states + DC)", () => {
    for (const state of US_STATES) {
      expect(STATE_FIPS_CODES[state.code], `missing FIPS code for ${state.code}`).toBeDefined();
      expect(STATE_FIPS_CODES[state.code]).toMatch(/^\d{2}$/);
    }
    expect(Object.keys(STATE_FIPS_CODES)).toHaveLength(US_STATES.length);
  });

  it("has no duplicate FIPS codes (each state distinct)", () => {
    const codes = Object.values(STATE_FIPS_CODES);
    expect(new Set(codes).size).toBe(codes.length);
  });
});

describe("FETCH_TIMEOUT_MS", () => {
  it("stays safely under the route's maxDuration so a slow Census API surfaces our own JSON error instead of Vercel's platform HTML timeout page", () => {
    // Regression guard for the bug reported in production: the internal
    // fetch timeout (120s) exceeded maxDuration (60s), so Vercel killed the
    // function first and returned an HTML error page that broke
    // response.json() on the client ("Unexpected token '<'").
    expect(FETCH_TIMEOUT_MS).toBeLessThan(REASONABLE_MAX_DURATION_S * 1000);
  });
});

function acsResponseFor(zip: string) {
  return {
    ok: true,
    json: async () => [
      ["B01003_001E", "B11001_001E", "B19013_001E", "state", "zip code tabulation area"],
      ["1000", "400", "80000", "48", zip],
    ],
  };
}

describe("fetchAcsNational (per-state querying)", () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.CENSUS_API_KEY;

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.CENSUS_API_KEY;
    else process.env.CENSUS_API_KEY = originalKey;
    vi.restoreAllMocks();
  });

  it("issues one state-scoped request per state (regression guard: a single nationwide wildcard query was observed silently truncated in production)", async () => {
    delete process.env.CENSUS_API_KEY;
    const fetchMock = vi.fn().mockResolvedValue(acsResponseFor("75201"));
    global.fetch = fetchMock as unknown as typeof fetch;

    await fetchAcsNational(2023, ["B01003_001E"]);

    expect(fetchMock).toHaveBeenCalledTimes(US_STATES.length);
    const urls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(urls.every((u) => /&in=state:\d{2}$|&in=state:\d{2}&/.test(u))).toBe(true);
    expect(urls.every((u) => !u.includes("&key="))).toBe(true);
  });

  it("appends the key param per request when CENSUS_API_KEY is set", async () => {
    process.env.CENSUS_API_KEY = "test-key-123";
    const fetchMock = vi.fn().mockResolvedValue(acsResponseFor("75201"));
    global.fetch = fetchMock as unknown as typeof fetch;

    await fetchAcsNational(2023, ["B01003_001E"]);

    const urls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(urls.every((u) => u.includes("&key=test-key-123"))).toBe(true);
  });

  it("trims a key with copy-pasted whitespace instead of sending a corrupted query string", async () => {
    process.env.CENSUS_API_KEY = "  test-key-123\n";
    const fetchMock = vi.fn().mockResolvedValue(acsResponseFor("75201"));
    global.fetch = fetchMock as unknown as typeof fetch;

    await fetchAcsNational(2023, ["B01003_001E"]);

    const urls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(urls.every((u) => u.includes("&key=test-key-123"))).toBe(true);
    expect(urls.every((u) => !u.includes("%0A") && !u.includes("%20test"))).toBe(true);
  });

  it("sends a descriptive User-Agent on every request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(acsResponseFor("75201"));
    global.fetch = fetchMock as unknown as typeof fetch;

    await fetchAcsNational(2023, ["B01003_001E"]);

    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers["User-Agent"]).toMatch(/GenDevCompass/);
  });

  it("one state failing does not lose the other states' data — it's reported, not silent", async () => {
    let call = 0;
    const fetchMock = vi.fn().mockImplementation(() => {
      call += 1;
      if (call === 3) return Promise.resolve({ ok: false, status: 503 });
      return Promise.resolve(acsResponseFor(String(10000 + call)));
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await fetchAcsNational(2023, ["B01003_001E"]);

    expect(result.failedStates).toHaveLength(1);
    expect(result.demographics.size).toBe(US_STATES.length - 1);
  });

  it("includes the response body in a failure's error message — a bare status code alone wasn't enough to diagnose a real production incident", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => "error: unknown/invalid api key",
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(fetchAcsForState(2023, ["B01003_001E"], "06")).rejects.toThrow(
      "HTTP 400: error: unknown/invalid api key",
    );
  });

  it("still reports the status code when the response has no readable body (e.g. a mock without .text())", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 503 });
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(fetchAcsForState(2023, ["B01003_001E"], "06")).rejects.toThrow("HTTP 503");
  });

  it("respects the concurrency cap without deadlocking (regression guard against workers stalling)", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const fetchMock = vi.fn().mockImplementation(async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 1));
      inFlight -= 1;
      return acsResponseFor("75201");
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    await fetchAcsNational(2023, ["B01003_001E"]);

    expect(fetchMock).toHaveBeenCalledTimes(US_STATES.length);
    expect(maxInFlight).toBeLessThanOrEqual(STATE_FETCH_CONCURRENCY);
  });
});

describe("downloadCensusDemographics", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("merges current + prior vintages and surfaces failedStates from either", async () => {
    const fetchMock = vi.fn().mockResolvedValue(acsResponseFor("75201"));
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await downloadCensusDemographics();

    expect(result.vintageLabel).toBe("2019-2023");
    expect(result.demographics.get("75201")).toMatchObject({ population: 1000 });
    expect(result.failedStates).toEqual([]);
    // 51 states x 2 vintages
    expect(fetchMock).toHaveBeenCalledTimes(US_STATES.length * 2);
  });
});

describe("buildDemographicsUpsertRows", () => {
  const existingRows = [
    {
      zip_code: "75078",
      city: "Prosper",
      state_code: "TX",
      county_name: "Collin",
      latitude: 33.2,
      longitude: -96.8,
      timezone: "America/Chicago",
      created_at: "2025-01-01T00:00:00.000Z",
    },
    {
      zip_code: "99999",
      city: "Nowhere",
      state_code: "ZZ",
      county_name: null,
      latitude: 0,
      longitude: 0,
      timezone: null,
      created_at: "2025-01-01T00:00:00.000Z",
    },
  ];

  const census = {
    demographics: new Map([
      [
        "75078",
        { population: 84600, households: 24000, medianHouseholdIncome: 112000, populationGrowthPct: 8.2 },
      ],
    ]),
    vintageLabel: "2019-2023",
  };

  it("returns a full valid row (satisfying NOT NULL columns) only for ZIPs that matched Census data", () => {
    const rows = buildDemographicsUpsertRows(existingRows, census, "2026-01-01T00:00:00.000Z");

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      zip_code: "75078",
      city: "Prosper",
      state_code: "TX",
      latitude: 33.2,
      longitude: -96.8,
      population: 84600,
      households: 24000,
      median_household_income: 112000,
      population_growth_pct: 8.2,
      demographics_source: CENSUS_SOURCE_LABEL,
      demographics_vintage: "2019-2023",
    });
  });

  it("leaves ZIPs with no Census match out of the write set entirely", () => {
    const rows = buildDemographicsUpsertRows(existingRows, census, "2026-01-01T00:00:00.000Z");
    expect(rows.find((r) => r.zip_code === "99999")).toBeUndefined();
  });

  it("returns an empty array when nothing matches (never writes zeroed-out placeholder rows)", () => {
    const rows = buildDemographicsUpsertRows(
      existingRows,
      { demographics: new Map(), vintageLabel: "2019-2023" },
      "2026-01-01T00:00:00.000Z",
    );
    expect(rows).toEqual([]);
  });
});

describe("coveredDemographicsStates", () => {
  it("marks a state covered once enough of its rows carry the current vintage label", () => {
    const covered = coveredDemographicsStates([
      { state_code: "TX", demographics_vintage: DEMOGRAPHICS_VINTAGE_LABEL },
      { state_code: "TX", demographics_vintage: null }, // 1 of 2 TX rows (50%) — above the threshold
      { state_code: "CA", demographics_vintage: "2018-2022" }, // stale vintage from a prior ACS release
      { state_code: "NY", demographics_vintage: null },
    ]);
    expect(covered).toEqual(new Set(["TX"]));
  });

  it("returns an empty set when nothing has the current vintage yet", () => {
    expect(coveredDemographicsStates([{ state_code: "TX", demographics_vintage: null }])).toEqual(new Set());
    expect(coveredDemographicsStates([])).toEqual(new Set());
  });

  it("does not mark a state covered from a small stale leftover — the real production bug", () => {
    // 19 of 2,600 TX rows carrying the vintage (0.7%) was the actual state
    // of production: leftover from the original truncated import, which
    // an earlier ">0 rows" check treated as "done" and skipped forever.
    const rows = [
      { state_code: "TX", demographics_vintage: DEMOGRAPHICS_VINTAGE_LABEL },
      ...Array.from({ length: 99 }, () => ({ state_code: "TX", demographics_vintage: null })),
    ];
    expect(coveredDemographicsStates(rows)).toEqual(new Set());
  });

  it("marks a state covered once a real majority of its rows carry the current vintage", () => {
    const rows = [
      ...Array.from({ length: 25 }, () => ({ state_code: "TX", demographics_vintage: DEMOGRAPHICS_VINTAGE_LABEL })),
      ...Array.from({ length: 75 }, () => ({ state_code: "TX", demographics_vintage: null })),
    ];
    expect(coveredDemographicsStates(rows)).toEqual(new Set(["TX"]));
  });
});
