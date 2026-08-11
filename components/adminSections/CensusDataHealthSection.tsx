"use client";

import { useEffect, useState } from "react";
import { formatDateTime } from "./shared";

export interface CensusDataHealth {
  vintage: string;
  totalGeographyRecords: number;
  totalDemographicRecords: number;
  coveragePercent: number;
  statesCovered: number;
  statesTotal: number;
  lastSuccessfulImport: { id: string; vintage: string; startedAt: string; finishedAt: string | null; statesDone: number } | null;
  lastFailedImport: { id: string; vintage: string; startedAt: string; finishedAt: string | null; error: string | null } | null;
  currentJob: {
    id: string;
    status: "running" | "succeeded" | "failed";
    trigger: "cron" | "manual" | "system";
    statesDone: number;
    statesFailed: number;
    statesTotal: number;
    startedAt: string;
    lastError: string | null;
  } | null;
  nextScheduledRefresh: string;
}

/**
 * Census demographics as backend infrastructure: this panel is what an
 * admin actually looks at day to day — data health, not a button they
 * have to remember to click. "Run Manual Refresh" is a secondary recovery
 * tool for development or when something needs a nudge; it enqueues a
 * backend job and returns immediately (see
 * app/api/admin/import-demographics/route.ts) — the job then runs to
 * completion server-side (app/api/cron/census-worker/route.ts), entirely
 * independent of this page staying open. The panel polls while a job is
 * active so progress is visible, but closing the tab never stops it.
 */
export function CensusDataHealthSection({
  authHeaders,
  hideHeader = false,
}: {
  authHeaders: Record<string, string>;
  /** The dedicated admin page already renders a title — skip the card's own. */
  hideHeader?: boolean;
}) {
  const [health, setHealth] = useState<CensusDataHealth | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function loadHealth() {
    try {
      const response = await fetch("/api/admin/census-health", { headers: authHeaders });
      const data = await response.json();
      if (!data.success) {
        setError(data.error ?? `Failed to load (${response.status})`);
        return;
      }
      setError(null);
      setHealth(data.health as CensusDataHealth);
    } catch (err) {
      setError(err instanceof Error ? err.message : "network error");
    }
  }

  useEffect(() => {
    loadHealth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!health?.currentJob) return;
    // A job is actively running server-side — poll to show live progress.
    // This interval is purely cosmetic: stopping it (by navigating away)
    // has no effect on the job itself.
    const interval = setInterval(loadHealth, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [health?.currentJob?.id]);

  async function runManualRefresh() {
    setRefreshing(true);
    try {
      const response = await fetch("/api/admin/import-demographics", {
        method: "POST",
        headers: authHeaders,
      });
      const data = await response.json();
      if (!data.success) {
        setError(data.error ?? `Failed to enqueue (${response.status})`);
        return;
      }
      await loadHealth();
    } catch (err) {
      setError(err instanceof Error ? err.message : "network error");
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      {!hideHeader && <h3 className="text-sm font-semibold text-gray-900">Census Data Health</h3>}
      <p className="mt-0.5 text-xs text-gray-500">
        Real population, households, median income, and 5-year growth from the U.S. Census
        Bureau&apos;s ACS 5-Year data, loaded automatically as backend infrastructure — a daily
        job checks for an incomplete or outdated import and runs it server-side, independent of
        this page. Territory searches always read from the database below, never live from
        census.gov.
      </p>

      {error && (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}

      {!health ? (
        <p className="mt-3 text-xs text-gray-500">Loading…</p>
      ) : (
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-4">
          <div>
            <dt className="text-[11px] text-gray-500">Active ACS vintage</dt>
            <dd className="text-sm font-medium text-gray-900">{health.vintage}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-gray-500">Geography records</dt>
            <dd className="text-sm font-medium text-gray-900">
              {health.totalGeographyRecords.toLocaleString()}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] text-gray-500">Demographic records</dt>
            <dd className="text-sm font-medium text-gray-900">
              {health.totalDemographicRecords.toLocaleString()}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] text-gray-500">Coverage</dt>
            <dd className="text-sm font-medium text-gray-900">
              {health.coveragePercent}% · {health.statesCovered}/{health.statesTotal} states
            </dd>
          </div>
          <div>
            <dt className="text-[11px] text-gray-500">Current job</dt>
            <dd className="text-sm font-medium text-gray-900">
              {health.currentJob ? (
                <>
                  Running ({health.currentJob.trigger}) —{" "}
                  {health.currentJob.statesDone}/{health.currentJob.statesTotal} states
                  {health.currentJob.statesFailed > 0 && `, ${health.currentJob.statesFailed} retrying`}
                </>
              ) : (
                "Idle"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] text-gray-500">Next scheduled refresh</dt>
            <dd className="text-sm font-medium text-gray-900">
              {formatDateTime(health.nextScheduledRefresh)}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] text-gray-500">Last successful import</dt>
            <dd className="text-sm font-medium text-gray-900">
              {health.lastSuccessfulImport
                ? `${formatDateTime(health.lastSuccessfulImport.finishedAt)} (${health.lastSuccessfulImport.statesDone} states)`
                : "Never"}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] text-gray-500">Last failed import</dt>
            <dd className="text-sm font-medium text-gray-900">
              {health.lastFailedImport ? formatDateTime(health.lastFailedImport.finishedAt) : "None"}
            </dd>
          </div>
        </dl>
      )}

      {health?.lastFailedImport?.error && (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Last failure: {health.lastFailedImport.error}
        </p>
      )}
      {health?.currentJob?.lastError && (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Retrying — most recent error: {health.currentJob.lastError}
        </p>
      )}

      <button
        onClick={runManualRefresh}
        disabled={refreshing || health?.currentJob != null}
        className="mt-4 rounded-lg border border-gray-300 px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
      >
        {health?.currentJob ? "Refresh in progress…" : refreshing ? "Enqueuing…" : "Run Manual Refresh"}
      </button>
      <p className="mt-1.5 text-[11px] text-gray-400">
        A recovery tool for development or a forced update — enqueues a backend job and returns
        immediately. Not required for normal operation.
      </p>
    </div>
  );
}
