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
import { pickUncoveredStates, targetPolygonStates, SUPPORTED_POLYGON_STATES } from "@/lib/territory/polygonImport";
import { listBundledStates, loadBundledStateRows, readZctaBundleManifest } from "@/lib/territory/zctaBundle";
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

  it("defaults to the whole country (all 50 states + DC)", () => {
    delete process.env.TERRITORY_POLYGON_STATES;
    expect(targetPolygonStates()).toEqual(SUPPORTED_POLYGON_STATES);
    expect(targetPolygonStates()).toHaveLength(51);
  });

  it("honors TERRITORY_POLYGON_STATES, filtered to states with a real boundary source", () => {
    process.env.TERRITORY_POLYGON_STATES = "tx, oh , not-a-state";
    expect(targetPolygonStates()).toEqual(["TX", "OH"]);
  });
});

describe("pickUncoveredStates", () => {
  it("returns the target states not yet covered, in target order", () => {
    expect(pickUncoveredStates(["TX", "TN", "FL"], new Set(["TN"]))).toEqual(["TX", "FL"]);
  });

  it("returns empty once every target state is covered (the sync becomes a no-op)", () => {
    expect(pickUncoveredStates(["TX", "TN"], new Set(["TX", "TN"]))).toEqual([]);
  });
});

describe("shipped ZCTA bundle (data/zcta)", () => {
  it("covers the whole country: all 50 states + DC, tens of thousands of ZCTAs", () => {
    const manifest = readZctaBundleManifest();
    expect(manifest).not.toBeNull();
    expect(listBundledStates()).toHaveLength(51);
    expect(listBundledStates()).toEqual(expect.arrayContaining(SUPPORTED_POLYGON_STATES));
    const totalZctas = manifest!.states.reduce((sum, s) => sum + s.zctas, 0);
    expect(totalZctas).toBeGreaterThan(30_000);
  });

  it("loads upsert-ready rows with valid simplified geometries (spot check: DC)", () => {
    const rows = loadBundledStateRows("DC");
    expect(rows).not.toBeNull();
    expect(rows!.length).toBeGreaterThan(10);
    for (const row of rows!) {
      expect(row.zip_code).toMatch(/^\d{5}$/);
      expect(row.state_code).toBe("DC");
      expect(["Polygon", "MultiPolygon"]).toContain((row.geojson as { type?: string }).type);
      expect(row.geometry_version).toBe("census-zcta-2010/opendatade");
    }
  });

  it("returns null for a state that is not bundled (download fallback path)", () => {
    expect(loadBundledStateRows("ZZ")).toBeNull();
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

  it("syncPolygons loads every uncovered target state and skips covered ones on re-run", async () => {
    vi.stubEnv("TERRITORY_POLYGON_STATES", "DC");
    // Deterministic regardless of module-cache state: serve DC via the
    // download fallback so the test never depends on the bundle dir's
    // cwd binding (the bundle read path has its own tests above).
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        features: [
          {
            properties: { ZCTA5CE10: "20001", INTPTLAT10: "38.91", INTPTLON10: "-77.02" },
            geometry: { type: "Polygon", coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] },
          },
        ],
      }),
    }) as unknown as typeof fetch;

    const { syncPolygons } = await import("@/lib/territory/polygonImport");
    const first = await syncPolygons(45_000);
    expect(first.loadedStates).toEqual(["DC"]);
    // Row count depends on which path served DC (bundle when the module
    // cache is intact, fallback otherwise) — either way, rows landed.
    expect(first.written).toBeGreaterThan(0);
    expect(first.remainingStates).toEqual([]);
    expect(await store.hasZipGeographiesForState("DC")).toBe(true);

    // Second run: DC is covered → fast no-op, nothing re-fetched.
    const fetchCallsBefore = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.length;
    const second = await syncPolygons(45_000);
    expect(second.loadedStates).toEqual([]);
    expect(second.remainingStates).toEqual([]);
    expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(fetchCallsBefore);

    vi.unstubAllEnvs();
  });
});
