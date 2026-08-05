import { NextResponse } from "next/server";
import { authorizedAdminRequest } from "@/lib/advisor/adminAccess";
import { clientIpFrom, rateLimit } from "@/lib/rateLimit";
import { syncDemographics } from "@/lib/geocoding/censusImport";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Stays safely inside maxDuration; the client re-invokes while remainingStates is non-empty. */
const SYNC_BUDGET_MS = 45_000;

/**
 * Loads real Census ACS demographics (population, households, median income,
 * 5-year growth) onto the nationwide ZIP reference already loaded by "Load
 * Nationwide ZIP Data" — see lib/geocoding/censusImport.ts (syncDemographics)
 * for the actual work. Each call loads as many uncovered states as fit in
 * the time budget and reports what's left; the admin UI keeps calling until
 * `remainingStates` is empty, the same pattern as import-polygons. Also runs
 * automatically via the weekly cron job (app/api/cron/refresh-demographics/
 * route.ts); this button is a manual override, not the only way to trigger it.
 *
 * Idempotent: upserts by zip_code; safe to run repeatedly.
 */
export async function POST(request: Request): Promise<NextResponse> {
  if (!rateLimit(`import-demographics:${clientIpFrom(request)}`, 20, 60_000)) {
    return NextResponse.json({ success: false, error: "Too many requests" }, { status: 429 });
  }
  if (!(await authorizedAdminRequest(request))) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncDemographics(SYNC_BUDGET_MS);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("[admin/import-demographics] failed:", error);
    const message =
      error instanceof Error && error.name === "TimeoutError"
        ? "Census API did not respond in time — please try again."
        : error instanceof Error
          ? error.message
          : "Import failed";
    const status = error instanceof Error && /No ZIP reference/.test(error.message) ? 409 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
