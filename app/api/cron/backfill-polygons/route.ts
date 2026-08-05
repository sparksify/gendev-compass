import { NextResponse } from "next/server";
import { authorizedCron } from "@/lib/config/cron";
import { syncPolygons } from "@/lib/territory/polygonImport";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Stays safely inside maxDuration; the next daily run picks up any remainder. */
const SYNC_BUDGET_MS = 45_000;

/**
 * Scheduled (see vercel.json) backfill of ZIP boundary shapes from the
 * shipped nationwide bundle (all 50 states + DC pre-processed into
 * data/zcta/ — no runtime downloads). Each run loads as many uncovered
 * target states as fit in the time budget; with bundled data the whole
 * country typically completes within one or two runs, after which this is
 * a fast no-op. The admin "Load All Boundary Shapes" button is the manual
 * counterpart (same shared logic: lib/territory/polygonImport.ts,
 * syncPolygons).
 */
export async function GET(request: Request): Promise<NextResponse> {
  if (!authorizedCron(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncPolygons(SYNC_BUDGET_MS);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("[cron/backfill-polygons] failed:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Backfill failed" },
      { status: 500 },
    );
  }
}
