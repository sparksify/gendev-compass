/**
 * Read-only Census data health for the admin dashboard, plus the one
 * intentional side effect requirement #6 needs: detecting that the current
 * ACS vintage has never been fully imported (a fresh/empty environment, or
 * a new ACS release bumping the vintage) and starting a job for it — no
 * human has to notice the empty state and click a button. Kept separate
 * from getCensusDataHealth (pure read) so that side effect is explicit and
 * visible at the call site, not buried inside a health check.
 */
import { coveredDemographicsStates, DEMOGRAPHICS_VINTAGE_LABEL, STATE_FIPS_CODES } from "./censusImport";
import { enqueueCensusImportJob, resumeStuckJobIfAny } from "./censusJob";
import type { CensusImportJobRecord, CensusImportJobStatus, CensusImportJobTrigger } from "@/types/territory";

/** The daily health-check cron's schedule (vercel.json) — used only to
 *  compute "next scheduled refresh" for the admin dashboard. */
const HEALTH_CHECK_HOUR_UTC = 9;

function nextDailyOccurrenceUtc(hourUtc: number): string {
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hourUtc, 0, 0));
  if (next.getTime() <= now.getTime()) next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString();
}

export interface CensusDataHealth {
  vintage: string;
  totalGeographyRecords: number;
  totalDemographicRecords: number;
  /** totalDemographicRecords / totalGeographyRecords, as a 0–100 percentage. */
  coveragePercent: number;
  statesCovered: number;
  statesTotal: number;
  lastSuccessfulImport: {
    id: string;
    vintage: string;
    startedAt: string;
    finishedAt: string | null;
    statesDone: number;
  } | null;
  lastFailedImport: {
    id: string;
    vintage: string;
    startedAt: string;
    finishedAt: string | null;
    error: string | null;
  } | null;
  currentJob: {
    id: string;
    status: CensusImportJobStatus;
    trigger: CensusImportJobTrigger;
    statesDone: number;
    statesFailed: number;
    statesTotal: number;
    startedAt: string;
    lastError: string | null;
  } | null;
  /** Next scheduled refresh — the health-check cron, which only starts a
   *  new import if the current vintage hasn't fully synced yet (a stale
   *  vintage or a resumed job runs sooner, via the cron's stuck-job check). */
  nextScheduledRefresh: string;
}

export async function getCensusDataHealth(): Promise<CensusDataHealth> {
  const { getStore } = await import("@/lib/store");
  const store = getStore();

  const [rows, recentJobs, activeJob] = await Promise.all([
    store.listZipCodeReferences(),
    store.listCensusImportJobs(20),
    store.getActiveCensusImportJob(),
  ]);

  const totalGeographyRecords = rows.length;
  const totalDemographicRecords = rows.filter((r) => r.population != null).length;
  const coveragePercent =
    totalGeographyRecords > 0
      ? Math.round((totalDemographicRecords / totalGeographyRecords) * 1000) / 10
      : 0;
  const statesCovered = coveredDemographicsStates(rows).size;

  const lastSuccessful = recentJobs.find((j) => j.status === "succeeded") ?? null;
  const lastFailed = recentJobs.find((j) => j.status === "failed") ?? null;

  return {
    vintage: DEMOGRAPHICS_VINTAGE_LABEL,
    totalGeographyRecords,
    totalDemographicRecords,
    coveragePercent,
    statesCovered,
    statesTotal: Object.keys(STATE_FIPS_CODES).length,
    lastSuccessfulImport: lastSuccessful
      ? {
          id: lastSuccessful.id,
          vintage: lastSuccessful.vintage,
          startedAt: lastSuccessful.started_at,
          finishedAt: lastSuccessful.finished_at,
          statesDone: lastSuccessful.states_done,
        }
      : null,
    lastFailedImport: lastFailed
      ? {
          id: lastFailed.id,
          vintage: lastFailed.vintage,
          startedAt: lastFailed.started_at,
          finishedAt: lastFailed.finished_at,
          error: lastFailed.last_error,
        }
      : null,
    currentJob: activeJob
      ? {
          id: activeJob.id,
          status: activeJob.status,
          trigger: activeJob.trigger,
          statesDone: activeJob.states_done,
          statesFailed: activeJob.states_failed,
          statesTotal: activeJob.states_total,
          startedAt: activeJob.started_at,
          lastError: activeJob.last_error,
        }
      : null,
    nextScheduledRefresh: nextDailyOccurrenceUtc(HEALTH_CHECK_HOUR_UTC),
  };
}

/**
 * The self-healing entry point: resumes a job whose worker chain appears
 * to have broken, or — if nothing is running and the current ACS vintage
 * has never been fully imported (empty tables, a fresh deploy, or a new
 * ACS release) — starts one. Called by the daily health-check cron
 * (authoritative — guaranteed to run with no human involved) and
 * opportunistically by the admin health route on page load (a faster path
 * to the same outcome, not a requirement for it: closing the admin tab
 * has no effect on a job already under way).
 *
 * Never starts a job against an empty ZIP reference — that's a separate
 * pipeline (lib/geocoding/zipImport.ts) with its own cron; this reports
 * the gap via the health payload instead of failing a job immediately.
 *
 * Takes an already-computed `health` rather than calling
 * getCensusDataHealth() itself: that call pages through the entire
 * zip_code_reference table (tens of thousands of rows), and a caller that
 * also needs the health payload for its own response (the admin route)
 * would otherwise pay for that full scan twice in one request — the
 * difference between comfortably finishing and blowing the route's own
 * maxDuration in production.
 */
export async function reconcileCensusImportState(
  trigger: CensusImportJobTrigger,
  health: CensusDataHealth,
): Promise<{ action: "resumed" | "enqueued" | "none"; job: CensusImportJobRecord | null }> {
  const resumed = await resumeStuckJobIfAny();
  if (resumed.resumed) {
    const { getStore } = await import("@/lib/store");
    const job = resumed.jobId ? await getStore().getCensusImportJob(resumed.jobId) : null;
    return { action: "resumed", job };
  }
  if (resumed.jobId) return { action: "none", job: null }; // already running, not stuck

  if (health.totalGeographyRecords === 0) return { action: "none", job: null };

  const currentVintageEverSucceeded =
    health.lastSuccessfulImport?.vintage === DEMOGRAPHICS_VINTAGE_LABEL;
  if (currentVintageEverSucceeded) return { action: "none", job: null };

  const { job } = await enqueueCensusImportJob(trigger);
  return { action: "enqueued", job };
}
