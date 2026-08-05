import { NextResponse } from "next/server";
import { authorizedCron } from "@/lib/config/cron";
import { getStore } from "@/lib/store";
import { pickNextPolygonState, refreshStatePolygons, targetPolygonStates } from "@/lib/territory/polygonImport";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Scheduled (see vercel.json) incremental backfill of ZIP boundary
 * polygons — the automated counterpart to the per-state admin buttons,
 * which remain available as a manual override. Boundary shapes rarely
 * change (static between decennial Censuses) and one state can take up to
 * a minute, so this loads exactly ONE not-yet-covered target state per
 * run (see lib/territory/polygonImport.ts, targetPolygonStates /
 * pickNextPolygonState) instead of looping through all of them in one
 * function invocation. Once every target state is covered, this becomes a
 * fast no-op.
 */
export async function GET(request: Request): Promise<NextResponse> {
  if (!authorizedCron(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const store = getStore();
    const targets = targetPolygonStates();
    const coverage = await Promise.all(
      targets.map(async (state) => [state, await store.hasZipGeographiesForState(state)] as const),
    );
    const covered = new Set(coverage.filter(([, has]) => has).map(([state]) => state));
    const next = pickNextPolygonState(targets, covered);

    if (!next) {
      return NextResponse.json({ success: true, state: null, written: 0, message: "All target states covered." });
    }

    const result = await refreshStatePolygons(next);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("[cron/backfill-polygons] failed:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Backfill failed" },
      { status: 500 },
    );
  }
}
