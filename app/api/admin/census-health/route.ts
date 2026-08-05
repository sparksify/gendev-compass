import { NextResponse } from "next/server";
import { authorizedAdminRequest } from "@/lib/advisor/adminAccess";
import { clientIpFrom, rateLimit } from "@/lib/rateLimit";
import { getCensusDataHealth, reconcileCensusImportState } from "@/lib/geocoding/censusHealth";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

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
 */
export async function GET(request: Request): Promise<NextResponse> {
  if (!rateLimit(`census-health:${clientIpFrom(request)}`, 30, 60_000)) {
    return NextResponse.json({ success: false, error: "Too many requests" }, { status: 429 });
  }
  if (!(await authorizedAdminRequest(request))) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    await reconcileCensusImportState("system");
    const health = await getCensusDataHealth();
    return NextResponse.json({ success: true, health });
  } catch (error) {
    console.error("[admin/census-health] failed:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to load health" },
      { status: 500 },
    );
  }
}
