import { NextResponse } from "next/server";
import { authorizedAdminRequest } from "@/lib/advisor/adminAccess";
import { clientIpFrom, rateLimit } from "@/lib/rateLimit";
import { getCensusDataHealth, reconcileCensusImportState } from "@/lib/geocoding/censusHealth";

export const dynamic = "force-dynamic";
// getCensusDataHealth pages through the full zip_code_reference table
// (tens of thousands of rows, in parallel) — generous headroom over that,
// still well under the platform's 60s hard ceiling.
export const maxDuration = 30;

/**
 * Backs the admin "Census Data Health" panel — active vintage, record
 * counts, last successful/failed import, current job status, next
 * scheduled refresh, coverage percentage. Read-only from the dashboard's
 * point of view, with one deliberate side effect: it also opportunistically
 * resumes a stuck job or starts one if the current vintage has never
 * synced — a faster path to the same outcome the daily cron guarantees on
 * its own, not a replacement for it. Loading this page never itself does
 * any Census fetching; it only ever enqueues, the same as the manual
 * refresh button.
 *
 * Computes health exactly once per request and passes it into
 * reconcileCensusImportState (which needs it to decide whether to
 * enqueue) — see the comment on that function for why calling it twice
 * here would risk the route's own timeout.
 */
export async function GET(request: Request): Promise<NextResponse> {
  if (!rateLimit(`census-health:${clientIpFrom(request)}`, 30, 60_000)) {
    return NextResponse.json({ success: false, error: "Too many requests" }, { status: 429 });
  }
  if (!(await authorizedAdminRequest(request))) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const health = await getCensusDataHealth();
    const reconciled = await reconcileCensusImportState("system", health);
    // A newly enqueued/resumed job changes health.currentJob — patch it
    // into the already-computed payload rather than re-scanning the
    // whole table a second time just to pick up one field.
    const responseHealth = reconciled.job
      ? {
          ...health,
          currentJob: {
            id: reconciled.job.id,
            status: reconciled.job.status,
            trigger: reconciled.job.trigger,
            statesDone: reconciled.job.states_done,
            statesFailed: reconciled.job.states_failed,
            statesTotal: reconciled.job.states_total,
            startedAt: reconciled.job.started_at,
            lastError: reconciled.job.last_error,
          },
        }
      : health;
    return NextResponse.json({ success: true, health: responseHealth });
  } catch (error) {
    console.error("[admin/census-health] failed:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to load health" },
      { status: 500 },
    );
  }
}
