import { NextResponse } from "next/server";
import { authorizedAdminRequest } from "@/lib/advisor/adminAccess";
import { clientIpFrom, rateLimit } from "@/lib/rateLimit";
import { enqueueCensusImportJob } from "@/lib/geocoding/censusJob";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

/**
 * "Run Manual Refresh" — a secondary, admin-only recovery tool now that
 * Census demographics load automatically (see lib/geocoding/censusHealth.ts
 * and the daily health-check cron). This enqueues a backend job and
 * returns immediately; it does not fetch or write any Census data itself,
 * and closing this request (or the browser tab that made it) has no
 * effect on the job — see app/api/cron/census-worker/route.ts for the
 * actual worker, which runs independently, chunk by chunk, until done.
 *
 * Idempotent: if a job is already running, this returns it instead of
 * starting a second one.
 */
export async function POST(request: Request): Promise<NextResponse> {
  if (!rateLimit(`import-demographics:${clientIpFrom(request)}`, 5, 60_000)) {
    return NextResponse.json({ success: false, error: "Too many requests" }, { status: 429 });
  }
  if (!(await authorizedAdminRequest(request))) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { job, alreadyRunning } = await enqueueCensusImportJob("manual");
    return NextResponse.json({ success: true, job, alreadyRunning });
  } catch (error) {
    console.error("[admin/import-demographics] failed to enqueue job:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to enqueue job" },
      { status: 500 },
    );
  }
}
