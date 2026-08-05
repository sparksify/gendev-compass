import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildDemographicsUpsertRows,
  CENSUS_SOURCE_LABEL,
  downloadCensusDemographics,
  FETCH_TIMEOUT_MS,
} from "@/lib/geocoding/censusImport";

const ACS_MAX_DURATION_S = 60; // matches app/api/admin/import-demographics/route.ts maxDuration

describe("FETCH_TIMEOUT_MS", () => {
  it("stays safely under the route's maxDuration so a slow Census API surfaces our own JSON error instead of Vercel's platform HTML timeout page", () => {
    // Regression guard for the bug reported in production: the internal
    // fetch timeout (120s) exceeded maxDuration (60s), so Vercel killed the
    // function first and returned an HTML error page that broke
    // response.json() on the client ("Unexpected token '<'").
    expect(FETCH_TIMEOUT_MS).toBeLessThan(ACS_MAX_DURATION_S * 1000);
    // Leaves headroom for the store read + upserts that run in the same request.
    expect(FETCH_TIMEOUT_MS).toBeLessThanOrEqual(40_000);
  });
});

describe("downloadCensusDemographics fetch behavior", () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.CENSUS_API_KEY;

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.CENSUS_API_KEY;
    else process.env.CENSUS_API_KEY = originalKey;
    vi.restoreAllMocks();
  });

  function mockAcsResponse() {
    return {
      ok: true,
      json: async () => [
        ["B01003_001E", "B11001_001E", "B19013_001E", "zip code tabulation area"],
        ["1000", "400", "80000", "75078"],
      ],
    };
  }

  it("sends a descriptive User-Agent (some census.gov gateways reject default fetch headers)", async () => {
    delete process.env.CENSUS_API_KEY;
    const fetchMock = vi.fn().mockResolvedValue(mockAcsResponse());
    global.fetch = fetchMock as unknown as typeof fetch;

    await downloadCensusDemographics();

    expect(fetchMock).toHaveBeenCalled();
    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers["User-Agent"]).toMatch(/GenDevCompass/);
  });

  it("omits the key param when CENSUS_API_KEY is unset", async () => {
    delete process.env.CENSUS_API_KEY;
    const fetchMock = vi.fn().mockResolvedValue(mockAcsResponse());
    global.fetch = fetchMock as unknown as typeof fetch;

    await downloadCensusDemographics();

    const urls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(urls.every((u) => !u.includes("&key="))).toBe(true);
  });

  it("appends the key param when CENSUS_API_KEY is set (avoids the anonymous per-IP rate limit)", async () => {
    process.env.CENSUS_API_KEY = "test-key-123";
    const fetchMock = vi.fn().mockResolvedValue(mockAcsResponse());
    global.fetch = fetchMock as unknown as typeof fetch;

    await downloadCensusDemographics();

    const urls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(urls.every((u) => u.includes("&key=test-key-123"))).toBe(true);
  });

  it("throws a descriptive error on a non-OK response instead of parsing HTML as JSON", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 503 });
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(downloadCensusDemographics()).rejects.toThrow(/503/);
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
