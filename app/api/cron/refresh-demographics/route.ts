import { NextResponse } from "next/server";
import { authorizedCron } from "@/lib/config/cron";
import { syncDemographics } from "@/lib/geocoding/censusImport";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Leaves real margin under maxDuration — see the identical note in
 * app/api/admin/import-demographics/route.ts for why 45s wasn't safe: a
 * worker that picks up a new state right as the budget check passes can
 * still run up to FETCH_TIMEOUT_MS (20s) plus write time afterward.
 */
const SYNC_BUDGET_MS = 30_000;

/**
 * Scheduled (see vercel.json) refresh of Census ACS demographics onto the
 * ZIP reference — the automated counterpart to the "Load Census
 * Demographics" admin button, which remains available as a manual
 * override. Same underlying logic (lib/geocoding/censusImport.ts,
 * syncDemographics): loads as many uncovered states as fit in the time
 * budget and reports what's left, so one run of all 51 states against a
 * real, sometimes-slow government API never risks the platform killing the
 * function mid-flight and losing everything that hadn't been written yet.
 * Runs weekly (ACS 5-year estimates only update annually) — the ZIP
 * reference refresh cron should run first so there's something to attach
 * demographics to, but a run against a stale-but-present reference is
 * still useful, so this does not depend on that job succeeding first.
 */
export async function GET(request: Request): Promise<NextResponse> {
  if (!authorizedCron(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncDemographics(SYNC_BUDGET_MS);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("[cron/refresh-demographics] failed:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Refresh failed" },
      { status: 500 },
    );
  }
}
