import { NextResponse } from "next/server";
import { authorizedAdminRequest } from "@/lib/advisor/adminAccess";
import { z } from "zod";
import { clientIpFrom, rateLimit } from "@/lib/rateLimit";
import {
  refreshStatePolygons,
  SUPPORTED_POLYGON_STATES,
  syncPolygons,
} from "@/lib/territory/polygonImport";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Stays safely inside maxDuration; the client re-invokes while remainingStates is non-empty. */
const SYNC_BUDGET_MS = 45_000;

const bodySchema = z.object({
  /** Optional: reload one specific state. Omitted → sync every uncovered target state. */
  state: z
    .string()
    .trim()
    .toUpperCase()
    .refine((s) => SUPPORTED_POLYGON_STATES.includes(s), "Unsupported state code")
    .optional(),
});

/**
 * Loads ZIP boundary shapes from the shipped nationwide bundle (all 50
 * states + DC pre-processed into data/zcta/ — no runtime downloads; see
 * lib/territory/zctaBundle.ts). Without a body it syncs every target state
 * that has no coverage yet, within a time budget, and reports what's left —
 * the admin UI keeps calling until `remainingStates` is empty. With
 * `{state}` it force-reloads that one state. Also runs automatically via
 * the daily backfill cron; this endpoint is a manual override.
 *
 * Idempotent: upserts by zip_code; safe to run repeatedly.
 */
export async function POST(request: Request): Promise<NextResponse> {
  if (!rateLimit(`import-polygons:${clientIpFrom(request)}`, 20, 60_000)) {
    return NextResponse.json({ success: false, error: "Too many requests" }, { status: 429 });
  }
  if (!(await authorizedAdminRequest(request))) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid payload", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    if (parsed.data.state) {
      const result = await refreshStatePolygons(parsed.data.state);
      return NextResponse.json({
        success: true,
        loadedStates: [result.state],
        written: result.written,
        remainingStates: [],
      });
    }
    const result = await syncPolygons(SYNC_BUDGET_MS);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("[admin/import-polygons] failed:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Import failed" },
      { status: 500 },
    );
  }
}
