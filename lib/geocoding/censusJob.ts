/**
 * Census ACS demographics as backend infrastructure, not a browser-driven
 * button loop. A job row in `census_import_jobs` is the single source of
 * truth for "is a sync running, how far did it get, what failed" — the
 * worker updates it as it goes, and completely independent of whether any
 * browser tab is open. See docs/territory-advisor.md, "Census demographics
 * — automated backend infrastructure" for the operating model this
 * implements.
 *
 * How a job actually runs to completion without a persistent server
 * process: each invocation processes one time-budgeted chunk
 * (syncDemographics), then — if there's more work — schedules its own
 * continuation via a fire-and-forget request to the worker route, using
 * Next's `after()` so that request is guaranteed to go out before the
 * current serverless function exits. A chain of these keeps running,
 * chunk after chunk, until the job finishes — the browser that triggered
 * the *first* chunk (or no browser at all, if the trigger was the
 * scheduled cron) has no bearing on whether the chain continues.
 */
import { after } from "next/server";
import {
  CURRENT_VINTAGE_VARIABLES,
  DEMOGRAPHICS_VINTAGE_LABEL,
  syncDemographics,
  type StateSyncResult,
} from "./censusImport";
import type {
  CensusImportJobRecord,
  CensusImportJobTrigger,
} from "@/types/territory";

/** One chunk's fetch/write budget — see the identical margin note in
 *  app/api/cron/census-worker/route.ts for why this stays well under the
 *  route's maxDuration instead of "close to" it. */
export const CHUNK_BUDGET_MS = 30_000;

/** Safety cap against a job that can never finish (e.g. a persistently
 *  failing state retried forever) chaining requests indefinitely. A job
 *  that hits this is marked failed with a clear reason, not left running. */
const MAX_JOB_DURATION_MS = 2 * 60 * 60 * 1000; // 2 hours

const WORKER_PATH = "/api/cron/census-worker";

function workerUrl(): string {
  // Vercel sets VERCEL_URL to the current deployment's own hostname —
  // always correct for a server-to-server self-call, unlike a hardcoded
  // public domain that could point at a different environment.
  const host = process.env.VERCEL_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "localhost:3000";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  return `${protocol}://${host}${WORKER_PATH}`;
}

/** Fire-and-forget continuation — scheduled via after() so it's guaranteed
 *  to be sent before this invocation's response finishes, but never
 *  awaited by (and therefore never slows down) the caller. */
function scheduleWorkerContinuation(jobId: string): void {
  const sendContinuation = async () => {
    try {
      await fetch(workerUrl(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.CRON_SECRET ?? ""}`,
        },
        body: JSON.stringify({ jobId }),
      });
    } catch (error) {
      // The chain breaking here isn't silent: the job row simply stops
      // advancing, and the daily health-check cron's stuck-job recovery
      // (resumeStuckJobIfAny) picks it back up within STUCK_JOB_THRESHOLD_MS.
      console.error(`[census] failed to schedule worker continuation for job ${jobId}:`, error);
    }
  };
  try {
    // after() requires an active Next.js request scope — unavailable in
    // plain unit tests and, defensively, in any other context this ends
    // up called from. Same graceful-degradation path as a failed fetch
    // above: the stuck-job recovery is what actually guarantees the job
    // doesn't get lost, not this call succeeding.
    after(sendContinuation);
  } catch (error) {
    console.error(`[census] after() unavailable — could not schedule continuation for job ${jobId}:`, error);
  }
}

/**
 * Starts a new import job unless one is already running — the guard
 * against duplicate concurrent jobs, so a cron tick and a staff member's
 * manual click can never race each other into two parallel syncs. Returns
 * the existing job (untouched) if one was already active.
 */
export async function enqueueCensusImportJob(
  trigger: CensusImportJobTrigger,
): Promise<{ job: CensusImportJobRecord; alreadyRunning: boolean }> {
  const { getStore } = await import("@/lib/store");
  const store = getStore();

  const active = await store.getActiveCensusImportJob();
  if (active) return { job: active, alreadyRunning: true };

  const job = await store.createCensusImportJob({
    trigger,
    vintage: DEMOGRAPHICS_VINTAGE_LABEL,
    states_total: 51,
  });
  scheduleWorkerContinuation(job.id);
  return { job, alreadyRunning: false };
}

/**
 * Runs one budgeted chunk of a job and, if there's more work and the job
 * hasn't exceeded its safety cap, schedules its own continuation. Returns
 * once this chunk's work (and any continuation scheduling) is done — the
 * caller (the worker route) can respond to its own request immediately
 * after, since the continuation is already in flight via after().
 */
export async function runCensusImportChunk(jobId: string): Promise<{ continuing: boolean }> {
  const { getStore } = await import("@/lib/store");
  const store = getStore();

  const job = await store.getCensusImportJob(jobId);
  if (!job || job.status !== "running") return { continuing: false };

  const elapsedMs = Date.now() - new Date(job.started_at).getTime();
  if (elapsedMs > MAX_JOB_DURATION_MS) {
    await store.updateCensusImportJob(jobId, {
      status: "failed",
      last_error: `Exceeded the maximum job duration (${Math.round(MAX_JOB_DURATION_MS / 60_000)} min) — one or more states are likely failing on every attempt. See failedStateErrors from the most recent chunk.`,
      finished_at: new Date().toISOString(),
    });
    return { continuing: false };
  }

  try {
    const onStateResult = async (result: StateSyncResult) => {
      if (!result.success || !result.rawPayload) return;
      await store.recordCensusRawImport({
        job_id: jobId,
        vintage: DEMOGRAPHICS_VINTAGE_LABEL,
        state_code: result.state,
        variables: CURRENT_VINTAGE_VARIABLES,
        payload: result.rawPayload,
      });
    };

    const result = await syncDemographics(CHUNK_BUDGET_MS, onStateResult);

    const lastFailedState = result.failedStates.at(-1);
    await store.updateCensusImportJob(jobId, {
      states_done: result.statesCovered,
      states_failed: result.failedStates.length,
      last_error: lastFailedState
        ? `${lastFailedState}: ${result.failedStateErrors[lastFailedState]}`
        : job.last_error,
    });

    if (result.remainingStates.length === 0) {
      await store.updateCensusImportJob(jobId, { status: "succeeded", finished_at: new Date().toISOString() });
      return { continuing: false };
    }

    scheduleWorkerContinuation(jobId);
    return { continuing: true };
  } catch (error) {
    await store.updateCensusImportJob(jobId, {
      status: "failed",
      last_error: error instanceof Error ? error.message : String(error),
      finished_at: new Date().toISOString(),
    });
    return { continuing: false };
  }
}

/**
 * Resumes a job whose worker chain appears to have broken (updated_at
 * hasn't moved in a while, but it's still marked "running") — the
 * self-fetch in scheduleWorkerContinuation can fail silently (network
 * hiccup, cold start), and without this, that job would sit "running"
 * forever with no active chain behind it. Called from the daily
 * health-check cron.
 */
const STUCK_JOB_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes — several chunks' worth of silence

export async function resumeStuckJobIfAny(): Promise<{ resumed: boolean; jobId: string | null }> {
  const { getStore } = await import("@/lib/store");
  const store = getStore();
  const active = await store.getActiveCensusImportJob();
  if (!active) return { resumed: false, jobId: null };

  const idleMs = Date.now() - new Date(active.updated_at).getTime();
  if (idleMs < STUCK_JOB_THRESHOLD_MS) return { resumed: false, jobId: active.id };

  scheduleWorkerContinuation(active.id);
  return { resumed: true, jobId: active.id };
}
