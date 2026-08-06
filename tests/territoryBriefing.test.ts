import { describe, expect, it } from "vitest";
import {
  availabilitySignal,
  buildTerritoryAssessment,
  buildWhyThisMarket,
  US_MEDIAN_HOUSEHOLD_INCOME,
} from "@/lib/territory/briefing";
import { aggregateMarketData } from "@/lib/territory/evaluate";
import { buildDemographics, parseAcsResponse } from "@/lib/geocoding/censusImport";
import type { NearbyZip } from "@/lib/geocoding";
import type { TerritoryEvaluationResult, TerritoryResultStatus } from "@/types/territory";

function makeResult(overrides: Partial<TerritoryEvaluationResult> = {}): TerritoryEvaluationResult {
  return {
    status: "AVAILABLE",
    brandId: "b1",
    brandName: "Complete Mobile Drug Testing",
    location: {
      query: "Prosper, TX",
      displayName: "Prosper, TX 75078",
      city: "Prosper",
      stateCode: "TX",
      zipCode: "75078",
      latitude: 33.2,
      longitude: -96.8,
    },
    stateEligibility: { status: "approved" },
    evaluation: { radiusMiles: 10, zipCodes: ["75078"], matchedTerritoryCount: 0, overlapPercentage: 0 },
    marketData: {
      population: 84600,
      households: 24000,
      medianHouseholdIncome: 112000,
      populationGrowthPct: 8.2,
      zipsWithData: 4,
      source: "U.S. Census Bureau, ACS 5-Year",
    },
    alternatives: [],
    checkedAt: new Date().toISOString(),
    requiresManualReview: false,
    message: "",
    searchId: null,
    ...overrides,
  };
}

describe("availabilitySignal", () => {
  it("maps statuses to a deterministic 0-100 signal", () => {
    const cases: Array<[TerritoryResultStatus, number]> = [
      ["AVAILABLE", 92],
      ["MANUAL_REVIEW", 42],
      ["STATE_RESTRICTED", 12],
      ["UNAVAILABLE", 8],
    ];
    for (const [status, percent] of cases) {
      expect(availabilitySignal(makeResult({ status })).percent).toBe(percent);
    }
  });

  it("lowers the partial-availability signal as measured overlap grows", () => {
    const low = availabilitySignal(
      makeResult({
        status: "PARTIALLY_AVAILABLE",
        evaluation: { radiusMiles: 10, zipCodes: [], matchedTerritoryCount: 1, overlapPercentage: 10 },
      }),
    );
    const high = availabilitySignal(
      makeResult({
        status: "PARTIALLY_AVAILABLE",
        evaluation: { radiusMiles: 10, zipCodes: [], matchedTerritoryCount: 2, overlapPercentage: 60 },
      }),
    );
    expect(low.percent).toBeGreaterThan(high.percent);
    expect(high.percent).toBeGreaterThanOrEqual(40);
  });
});

describe("buildTerritoryAssessment", () => {
  it("writes a data-backed briefing with Census attribution and compliance close", () => {
    const paragraphs = buildTerritoryAssessment(makeResult());
    const text = paragraphs.join(" ");
    expect(text).toContain("Prosper");
    expect(text).toContain("$112,000");
    expect(text).toContain("8.2%");
    expect(text).toContain("U.S. Census Bureau");
    expect(text).toContain("strong candidate for further review");
    expect(paragraphs[paragraphs.length - 1]).toContain("confirmed by the GenDev team and the franchisor");
  });

  it("never mentions figures that are not loaded", () => {
    const paragraphs = buildTerritoryAssessment(
      makeResult({
        marketData: { population: null, households: null, medianHouseholdIncome: null, populationGrowthPct: null, zipsWithData: 0, source: null },
      }),
    );
    const text = paragraphs.join(" ");
    expect(text).not.toContain("$");
    expect(text).not.toContain("population of");
    expect(text).not.toContain("Census");
    // The screening outcome still reads as a briefing.
    expect(text).toContain("did not find a conflict");
  });

  it("returns nothing for unmapped statuses", () => {
    expect(buildTerritoryAssessment(makeResult({ status: "LOCATION_NOT_FOUND", marketData: { population: null, households: null, medianHouseholdIncome: null } }))).toEqual([]);
  });
});

describe("buildWhyThisMarket", () => {
  it("includes demand signals only when real data exists, plus honest caveats", () => {
    const sections = buildWhyThisMarket(makeResult());
    const titles = sections.map((s) => s.title);
    expect(titles[0]).toBe("Market demand signals");
    expect(titles).toContain("What still needs verification");
    const caveats = sections[sections.length - 1].points.join(" ");
    expect(caveats).toContain("Franchise Disclosure Document");
  });

  it("without data, states plainly that figures aren't loaded — never fabricates demand claims", () => {
    const sections = buildWhyThisMarket(
      makeResult({
        marketData: { population: null, households: null, medianHouseholdIncome: null, populationGrowthPct: null, zipsWithData: 0, source: null },
      }),
    );
    const demand = sections.find((s) => s.title === "Market demand signals");
    expect(demand).toBeDefined();
    expect(demand!.points).toHaveLength(1);
    expect(demand!.points[0]).toContain("aren't loaded yet");
    // No numbers invented anywhere in the fallback.
    expect(demand!.points[0]).not.toMatch(/\d/);
  });

  it("surfaces state registration caveats", () => {
    const sections = buildWhyThisMarket(makeResult({ stateEligibility: { status: "pending" } }));
    const caveats = sections[sections.length - 1].points.join(" ");
    expect(caveats).toContain("Pending");
  });
});

function zip(partial: Partial<NearbyZip>): NearbyZip {
  return {
    zipCode: "00000",
    city: "X",
    stateCode: "TX",
    latitude: 0,
    longitude: 0,
    distanceMiles: 1,
    population: null,
    households: null,
    medianHouseholdIncome: null,
    populationGrowthPct: null,
    demographicsSource: null,
    ...partial,
  };
}

describe("aggregateMarketData", () => {
  it("sums population/households and weights income and growth", () => {
    const data = aggregateMarketData([
      zip({ zipCode: "1", population: 10000, households: 4000, medianHouseholdIncome: 100000, populationGrowthPct: 10, demographicsSource: "ACS" }),
      zip({ zipCode: "2", population: 30000, households: 12000, medianHouseholdIncome: 60000, populationGrowthPct: 2 }),
    ]);
    expect(data.population).toBe(40000);
    expect(data.households).toBe(16000);
    // Household-weighted: (100k*4000 + 60k*12000) / 16000 = 70k
    expect(data.medianHouseholdIncome).toBe(70000);
    // Population-weighted: (10*10000 + 2*30000) / 40000 = 4
    expect(data.populationGrowthPct).toBe(4);
    expect(data.zipsWithData).toBe(2);
    expect(data.source).toBe("ACS");
  });

  it("returns all-null (never zeros) when no ZIP carries data", () => {
    const data = aggregateMarketData([zip({ zipCode: "1" }), zip({ zipCode: "2" })]);
    expect(data.population).toBeNull();
    expect(data.medianHouseholdIncome).toBeNull();
    expect(data.populationGrowthPct).toBeNull();
    expect(data.zipsWithData).toBe(0);
  });
});

describe("censusImport parsing", () => {
  const header = ["B01003_001E", "B11001_001E", "B19013_001E", "zip code tabulation area"];

  it("parses ACS rows and nulls sentinel/suppressed values", () => {
    const parsed = parseAcsResponse(
      [
        header,
        ["84600", "24000", "112000", "75078"],
        ["500", "200", "-666666666", "75001"], // suppressed income sentinel
        ["bad", "row", "x", "not-a-zip"],
      ],
      ["B01003_001E", "B11001_001E", "B19013_001E"],
    );
    expect(parsed.get("75078")).toEqual({ B01003_001E: 84600, B11001_001E: 24000, B19013_001E: 112000 });
    expect(parsed.get("75001")?.B19013_001E).toBeNull();
    expect(parsed.size).toBe(2);
  });

  it("computes 5-year growth from two vintages and skips unmatched ZCTAs", () => {
    const current = parseAcsResponse([header, ["108200", "1", "1", "75078"], ["9000", "1", "1", "75001"]], ["B01003_001E", "B11001_001E", "B19013_001E"]);
    const prior = parseAcsResponse([["B01003_001E", "zip code tabulation area"], ["100000", "75078"]], ["B01003_001E"]);
    const demographics = buildDemographics(current, prior);
    expect(demographics.get("75078")?.populationGrowthPct).toBe(8.2);
    expect(demographics.get("75001")?.populationGrowthPct).toBeNull();
  });
});

describe("benchmark sanity", () => {
  it("uses a plausible national income benchmark", () => {
    expect(US_MEDIAN_HOUSEHOLD_INCOME).toBeGreaterThan(60000);
    expect(US_MEDIAN_HOUSEHOLD_INCOME).toBeLessThan(100000);
  });
});
