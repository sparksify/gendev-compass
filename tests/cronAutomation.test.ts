/**
 * Tests for the scheduled backend automation: cron auth, the polygon
 * backfill's "pick next state" logic, and the shared refresh functions
 * (refreshZipReference / refreshDemographics) run end-to-end against the
 * file-backed dev store, following the same pattern as storeFlows.test.ts.
 */
import { mkdtempSync, rmSync } from "fs";
import os from "os";
import path from "path";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { authorizedCron } from "@/lib/config/cron";
import { pickNextPolygonState, targetPolygonStates, SUPPORTED_POLYGON_STATES } from "@/lib/territory/polygonImport";
import type { PortalStore } from "@/lib/store/types";

describe("authorizedCron", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("requires the exact Bearer token when CRON_SECRET is set, regardless of environment", () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    vi.stubEnv("NODE_ENV", "production");

    const authorized = new Request("https://x.test", { headers: { authorization: "Bearer s3cret" } });
    const wrongToken = new Request("https://x.test", { headers: { authorization: "Bearer nope" } });
    const noHeader = new Request("https://x.test");

    expect(authorizedCron(authorized)).toBe(true);
    expect(authorizedCron(wrongToken)).toBe(false);
    expect(authorizedCron(noHeader)).toBe(false);
  });

  it("without CRON_SECRET, falls back to allowing only outside production (same pattern as the admin routes)", () => {
    vi.stubEnv("CRON_SECRET", "");
    const request = new Request("https://x.test");

    vi.stubEnv("NODE_ENV", "production");
    expect(authorizedCron(request)).toBe(false);

    vi.stubEnv("NODE_ENV", "development");
    expect(authorizedCron(request)).toBe(true);
  });
});

describe("targetPolygonStates", () => {
  const originalStates = process.env.TERRITORY_POLYGON_STATES;
  afterEach(() => {
    if (originalStates === undefined) delete process.env.TERRITORY_POLYGON_STATES;
    else process.env.TERRITORY_POLYGON_STATES = originalStates;
  });

  it("defaults to the operating states the admin panel's manual buttons cover", () => {
    delete process.env.TERRITORY_POLYGON_STATES;
    expect(targetPolygonStates()).toEqual(["TX", "TN", "FL", "CA", "IL", "NY"]);
  });

  it("honors TERRITORY_POLYGON_STATES, filtered to states with a real boundary source", () => {
    process.env.TERRITORY_POLYGON_STATES = "tx, oh , not-a-state";
    expect(targetPolygonStates()).toEqual(["TX", "OH"]);
  });

  it("every default target state has a real boundary source", () => {
    delete process.env.TERRITORY_POLYGON_STATES;
    for (const state of targetPolygonStates()) {
      expect(SUPPORTED_POLYGON_STATES).toContain(state);
    }
  });
});

describe("pickNextPolygonState", () => {
  it("returns the first target state not yet covered", () => {
    expect(pickNextPolygonState(["TX", "TN", "FL"], new Set(["TX"]))).toBe("TN");
  });

  it("returns null once every target state is covered (the cron becomes a no-op)", () => {
    expect(pickNextPolygonState(["TX", "TN"], new Set(["TX", "TN"]))).toBeNull();
  });

  it("returns null for an empty target list", () => {
    expect(pickNextPolygonState([], new Set())).toBeNull();
  });
});

describe("refreshZipReference / refreshDemographics / hasZipGeographiesForState (dev store)", () => {
  const tmpDir = mkdtempSync(path.join(os.tmpdir(), "cron-automation-test-"));
  const originalCwd = process.cwd();
  const originalFetch = global.fetch;

  let store: PortalStore;
  let refreshZipReference: typeof import("@/lib/geocoding/zipImport").refreshZipReference;
  let refreshDemographics: typeof import("@/lib/geocoding/censusImport").refreshDemographics;

  beforeAll(async () => {
    process.chdir(tmpDir);
    const storeModule = await import("@/lib/store");
    store = storeModule.getStore();
    ({ refreshZipReference } = await import("@/lib/geocoding/zipImport"));
    ({ refreshDemographics } = await import("@/lib/geocoding/censusImport"));
  });

  afterAll(() => {
    process.chdir(originalCwd);
    rmSync(tmpDir, { recursive: true, force: true });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("refreshZipReference downloads, parses, and writes through the store", async () => {
    const geoNamesLine = "US\t75201\tDallas\tTexas\tTX\tDallas\t113\t\t\t32.7831\t-96.8067\t4";
    global.fetch = vi.fn().mockResolvedValue({ ok: true, text: async () => geoNamesLine }) as unknown as typeof fetch;

    const result = await refreshZipReference();

    expect(result.written).toBeGreaterThan(0);
    const row = await store.getZipCodeReference("75201");
    expect(row).toMatchObject({ city: "Dallas", state_code: "TX" });
  });

  it("refreshDemographics throws a clear, actionable error when no ZIP reference is loaded", async () => {
    // Fresh temp dir with nothing seeded yet.
    const emptyDir = mkdtempSync(path.join(os.tmpdir(), "cron-automation-empty-"));
    process.chdir(emptyDir);
    vi.resetModules();
    const { refreshDemographics: freshRefreshDemographics } = await import("@/lib/geocoding/censusImport");
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [["B01003_001E", "zip code tabulation area"]],
    }) as unknown as typeof fetch;

    await expect(freshRefreshDemographics()).rejects.toThrow(/No ZIP reference data loaded/);

    process.chdir(tmpDir);
    rmSync(emptyDir, { recursive: true, force: true });
    vi.resetModules();
  });

  it("refreshDemographics writes real figures once a ZIP reference exists (runs after the refreshZipReference test seeds 75201/TX)", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        ["B01003_001E", "B11001_001E", "B19013_001E", "zip code tabulation area"],
        ["84600", "24000", "112000", "75201"],
      ],
    }) as unknown as typeof fetch;

    const result = await refreshDemographics();

    expect(result.written).toBeGreaterThan(0);
    const row = await store.getZipCodeReference("75201");
    expect(row).toMatchObject({ population: 84600, median_household_income: 112000 });
  });

  it("hasZipGeographiesForState reflects coverage per state after an upsert", async () => {
    expect(await store.hasZipGeographiesForState("TX")).toBe(false);

    await store.upsertZipGeographies([
      {
        zip_code: "75201",
        state_code: "TX",
        latitude: 32.78,
        longitude: -96.8,
        geojson: { type: "Polygon", coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] },
        geometry_source: "test",
        geometry_version: "test",
      },
    ]);

    expect(await store.hasZipGeographiesForState("TX")).toBe(true);
    expect(await store.hasZipGeographiesForState("TN")).toBe(false);
  });
});
