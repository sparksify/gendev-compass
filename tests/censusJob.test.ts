/**
 * Tests for the Census import job infrastructure (lib/geocoding/censusJob.ts,
 * lib/geocoding/censusHealth.ts) and the store methods backing it — run
 * against the file-backed dev store, following the same isolation pattern
 * as tests/cronAutomation.test.ts. after() (Next's post-response hook) only
 * works inside a real request scope, so scheduleWorkerContinuation's
 * defensive try/catch is exercised here rather than mocked — these tests
 * verify job-row bookkeeping and control flow, not the actual HTTP
 * self-chain (which needs a running server; see the route file's own
 * authorizedCron gate for the piece these tests can't cover).
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import os from "os";
import path from "path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PortalStore } from "@/lib/store/types";

describe("Census import job infrastructure (dev store)", () => {
  const tmpDir = mkdtempSync(path.join(os.tmpdir(), "census-job-test-"));
  const originalCwd = process.cwd();
  const originalFetch = global.fetch;
  const storeFile = path.join(tmpDir, ".dev-data", "store.json");

  let store: PortalStore;
  let DEMOGRAPHICS_VINTAGE_LABEL: string;
  let enqueueCensusImportJob: typeof import("@/lib/geocoding/censusJob").enqueueCensusImportJob;
  let runCensusImportChunk: typeof import("@/lib/geocoding/censusJob").runCensusImportChunk;
  let resumeStuckJobIfAny: typeof import("@/lib/geocoding/censusJob").resumeStuckJobIfAny;

  beforeAll(async () => {
    process.chdir(tmpDir);
    const storeModule = await import("@/lib/store");
    store = storeModule.getStore();
    ({ DEMOGRAPHICS_VINTAGE_LABEL } = await import("@/lib/geocoding/censusImport"));
    ({ enqueueCensusImportJob, runCensusImportChunk, resumeStuckJobIfAny } = await import(
      "@/lib/geocoding/censusJob"
    ));
  });

  afterAll(() => {
    process.chdir(originalCwd);
    rmSync(tmpDir, { recursive: true, force: true });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe("store: census_import_jobs / census_acs_raw", () => {
    it("createCensusImportJob starts a job as 'running' with zeroed progress", async () => {
      const job = await store.createCensusImportJob({ trigger: "manual", vintage: "2019-2023", states_total: 51 });
      expect(job).toMatchObject({
        status: "running",
        trigger: "manual",
        vintage: "2019-2023",
        states_total: 51,
        states_done: 0,
        states_failed: 0,
        last_error: null,
        finished_at: null,
      });
      expect(await store.getCensusImportJob(job.id)).toMatchObject({ id: job.id });
      await store.updateCensusImportJob(job.id, { status: "succeeded", finished_at: new Date().toISOString() });
    });

    it("updateCensusImportJob patches fields and bumps updated_at", async () => {
      const job = await store.createCensusImportJob({ trigger: "cron", vintage: "2019-2023", states_total: 51 });
      const updated = await store.updateCensusImportJob(job.id, { states_done: 5, states_failed: 1 });
      expect(updated.states_done).toBe(5);
      expect(updated.states_failed).toBe(1);
      expect(updated.status).toBe("running"); // untouched fields keep their value
      await store.updateCensusImportJob(job.id, { status: "succeeded", finished_at: new Date().toISOString() });
    });

    it("getActiveCensusImportJob returns the running job, or null once it's finished", async () => {
      expect(await store.getActiveCensusImportJob()).toBeNull();
      const job = await store.createCensusImportJob({ trigger: "system", vintage: "2019-2023", states_total: 51 });
      expect((await store.getActiveCensusImportJob())?.id).toBe(job.id);
      await store.updateCensusImportJob(job.id, { status: "succeeded", finished_at: new Date().toISOString() });
      expect(await store.getActiveCensusImportJob()).toBeNull();
    });

    it("recordCensusRawImport upserts by (vintage, state_code) instead of accumulating history", async () => {
      await store.recordCensusRawImport({
        job_id: null,
        vintage: "2019-2023",
        state_code: "TX",
        variables: ["B01003_001E"],
        payload: { "75201": { B01003_001E: 1000 } },
      });
      expect(await store.countCensusAcsRaw()).toBe(1);
      await store.recordCensusRawImport({
        job_id: null,
        vintage: "2019-2023",
        state_code: "TX",
        variables: ["B01003_001E"],
        payload: { "75201": { B01003_001E: 2000 } }, // re-fetch replaces, doesn't append
      });
      expect(await store.countCensusAcsRaw()).toBe(1);
    });
  });

  describe("enqueueCensusImportJob", () => {
    it("starts a job and never starts a second one while it's running", async () => {
      const first = await enqueueCensusImportJob("manual");
      expect(first.alreadyRunning).toBe(false);
      expect(first.job.status).toBe("running");

      const second = await enqueueCensusImportJob("cron");
      expect(second.alreadyRunning).toBe(true);
      expect(second.job.id).toBe(first.job.id); // same job, not a duplicate

      await store.updateCensusImportJob(first.job.id, { status: "succeeded", finished_at: new Date().toISOString() });
    });
  });

  describe("runCensusImportChunk", () => {
    beforeEach(async () => {
      await store.upsertZipCodeReferences([
        {
          zip_code: "85001",
          city: "Phoenix",
          state_code: "AZ",
          county_name: null,
          latitude: 33.45,
          longitude: -112.07,
          timezone: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]);
    });

    it("returns continuing:false for a job that doesn't exist or already finished", async () => {
      expect(await runCensusImportChunk("not-a-real-id")).toEqual({ continuing: false });

      const job = await store.createCensusImportJob({ trigger: "manual", vintage: "x", states_total: 1 });
      await store.updateCensusImportJob(job.id, { status: "succeeded", finished_at: new Date().toISOString() });
      expect(await runCensusImportChunk(job.id)).toEqual({ continuing: false });
    });

    it("marks the job failed with a clear reason once it exceeds the maximum duration", async () => {
      const job = await store.createCensusImportJob({ trigger: "manual", vintage: "x", states_total: 51 });
      // Backdate started_at past the 2-hour safety cap by editing the store
      // file directly — the only way to simulate elapsed time without
      // mocking Date globally (which the rest of the app relies on).
      const raw = JSON.parse(readFileSync(storeFile, "utf8"));
      const record = raw.census_import_jobs.find((j: { id: string }) => j.id === job.id);
      record.started_at = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
      writeFileSync(storeFile, JSON.stringify(raw));

      const result = await runCensusImportChunk(job.id);
      expect(result).toEqual({ continuing: false });
      const finished = await store.getCensusImportJob(job.id);
      expect(finished?.status).toBe("failed");
      expect(finished?.last_error).toMatch(/maximum job duration/i);
    });

    it("writes population data, records a raw import, and marks the job succeeded once fully covered", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          ["B01003_001E", "B11001_001E", "B19013_001E", "zip code tabulation area"],
          ["1000", "400", "50000", "85001"],
        ],
      }) as unknown as typeof fetch;

      const { job } = await enqueueCensusImportJob("manual");
      const result = await runCensusImportChunk(job.id);
      // With one ZIP reference row (a single state) and a mock that never
      // errors, everything completes within one chunk.
      expect(result).toEqual({ continuing: false });

      const finished = await store.getCensusImportJob(job.id);
      expect(finished?.status).toBe("succeeded");
      expect(finished?.states_done).toBeGreaterThan(0);
      expect(finished?.finished_at).not.toBeNull();

      const row = await store.getZipCodeReference("85001");
      expect(row).toMatchObject({ population: 1000, demographics_vintage: DEMOGRAPHICS_VINTAGE_LABEL });
      expect(await store.countCensusAcsRaw()).toBeGreaterThan(0);
    });
  });

  describe("resumeStuckJobIfAny", () => {
    it("does nothing when no job is running", async () => {
      expect(await resumeStuckJobIfAny()).toEqual({ resumed: false, jobId: null });
    });

    it("does not resume a job that's merely running and recently updated", async () => {
      const job = await store.createCensusImportJob({ trigger: "manual", vintage: "x", states_total: 51 });
      expect(await resumeStuckJobIfAny()).toEqual({ resumed: false, jobId: job.id });
      await store.updateCensusImportJob(job.id, { status: "succeeded", finished_at: new Date().toISOString() });
    });

    it("resumes a running job whose updated_at has gone stale", async () => {
      const job = await store.createCensusImportJob({ trigger: "cron", vintage: "x", states_total: 51 });
      const raw = JSON.parse(readFileSync(storeFile, "utf8"));
      const record = raw.census_import_jobs.find((j: { id: string }) => j.id === job.id);
      record.updated_at = new Date(Date.now() - 20 * 60 * 1000).toISOString(); // 20 minutes idle
      writeFileSync(storeFile, JSON.stringify(raw));

      expect(await resumeStuckJobIfAny()).toEqual({ resumed: true, jobId: job.id });
      await store.updateCensusImportJob(job.id, { status: "succeeded", finished_at: new Date().toISOString() });
    });
  });

  describe("getCensusDataHealth / reconcileCensusImportState", () => {
    it("reports zero coverage and no jobs against a bare ZIP reference", async () => {
      const emptyDir = mkdtempSync(path.join(os.tmpdir(), "census-job-empty-"));
      process.chdir(emptyDir);
      vi.resetModules();
      const { getCensusDataHealth: freshHealth } = await import("@/lib/geocoding/censusHealth");
      const health = await freshHealth();
      expect(health.totalGeographyRecords).toBe(0);
      expect(health.totalDemographicRecords).toBe(0);
      expect(health.currentJob).toBeNull();
      expect(health.lastSuccessfulImport).toBeNull();
      process.chdir(tmpDir);
      rmSync(emptyDir, { recursive: true, force: true });
      vi.resetModules();
    });

    it("reconcileCensusImportState does nothing against an empty ZIP reference", async () => {
      const emptyDir = mkdtempSync(path.join(os.tmpdir(), "census-job-empty2-"));
      process.chdir(emptyDir);
      vi.resetModules();
      const { getCensusDataHealth: freshHealth, reconcileCensusImportState: freshReconcile } = await import(
        "@/lib/geocoding/censusHealth"
      );
      const health = await freshHealth();
      expect(await freshReconcile("system", health)).toEqual({ action: "none", job: null });
      process.chdir(tmpDir);
      rmSync(emptyDir, { recursive: true, force: true });
      vi.resetModules();
    });

    it("enqueues once for a vintage that's never succeeded, then goes quiet once it has", async () => {
      // Fresh isolated dir so this test's job history doesn't collide with
      // the runCensusImportChunk tests above.
      const dir = mkdtempSync(path.join(os.tmpdir(), "census-job-reconcile-"));
      process.chdir(dir);
      vi.resetModules();
      const freshStoreModule = await import("@/lib/store");
      const freshStore = freshStoreModule.getStore();
      await freshStore.upsertZipCodeReferences([
        {
          zip_code: "10001",
          city: "New York",
          state_code: "NY",
          county_name: null,
          latitude: 40.75,
          longitude: -73.99,
          timezone: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]);
      const { getCensusDataHealth: freshHealth, reconcileCensusImportState: freshReconcile } = await import(
        "@/lib/geocoding/censusHealth"
      );
      const { DEMOGRAPHICS_VINTAGE_LABEL: freshVintage } = await import("@/lib/geocoding/censusImport");

      const first = await freshReconcile("system", await freshHealth());
      expect(first.action).toBe("enqueued");
      expect(first.job?.status).toBe("running");

      // A second check while the job is still running: neither a duplicate
      // enqueue nor a resume (it isn't stuck).
      const second = await freshReconcile("system", await freshHealth());
      expect(second.action).toBe("none");

      // Simulate the job completing successfully for the current vintage.
      await freshStore.updateCensusImportJob(first.job!.id, {
        status: "succeeded",
        finished_at: new Date().toISOString(),
      });
      const third = await freshReconcile("system", await freshHealth());
      expect(third.action).toBe("none"); // already succeeded for this vintage — quiet
      expect(freshVintage).toBe(first.job!.vintage);

      process.chdir(tmpDir);
      rmSync(dir, { recursive: true, force: true });
      vi.resetModules();
    });
  });
});
