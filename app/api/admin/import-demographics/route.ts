import { NextResponse } from "next/server";
import { getAdminTestPassword, isProduction } from "@/lib/config/env";
import { clientIpFrom, rateLimit } from "@/lib/rateLimit";
import {
  buildDemographicsUpsertRows,
  CENSUS_SOURCE_LABEL,
  downloadCensusDemographics,
} from "@/lib/geocoding/censusImport";
import { getStore } from "@/lib/store";
import type { UpsertZipCodeReferenceInput } from "@/types/territory";

export const dynamic = "force-dynamic";
/** Two ACS downloads (35s budget each, in parallel) + batched upserts. */
export const maxDuration = 60;

/** Same auth model as the other admin routes: header password, required in production. */
function authorized(request: Request): boolean {
  const adminPassword = getAdminTestPassword();
  const provided = request.headers.get("x-admin-password");
  if (adminPassword) return provided === adminPassword;
  return !isProduction();
}

/** Runs upserts with limited concurrency instead of one full sequential loop. */
async function upsertConcurrently(
  rows: UpsertZipCodeReferenceInput[],
  batchSize: number,
  concurrency: number,
): Promise<void> {
  const store = getStore();
  const batches: UpsertZipCodeReferenceInput[][] = [];
  for (let i = 0; i < rows.length; i += batchSize) batches.push(rows.slice(i, i + batchSize));

  let next = 0;
  async function worker() {
    while (next < batches.length) {
      const batch = batches[next++];
      await store.upsertZipCodeReferences(batch);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, batches.length) }, worker));
}

/**
 * Loads real Census ACS demographics (population, households, median income,
 * 5-year growth) onto the nationwide ZIP reference already loaded by "Load
 * Nationwide ZIP Data". Reads the existing rows from our own store (no
 * external GeoNames re-download — those rows already satisfy the table's
 * NOT NULL constraints), merges in the Census figures, and writes only the
 * ZIPs that actually matched Census data, concurrently, in batches — bulk
 * work never runs inside Postgres (see docs/territory-advisor.md).
 *
 * Idempotent: upserts by zip_code; safe to run repeatedly.
 */
export async function POST(request: Request): Promise<NextResponse> {
  if (!rateLimit(`import-demographics:${clientIpFrom(request)}`, 3, 60_000)) {
    return NextResponse.json({ success: false, error: "Too many requests" }, { status: 429 });
  }
  if (!authorized(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const store = getStore();
    const [existingRows, census] = await Promise.all([
      store.listZipCodeReferences(),
      downloadCensusDemographics(),
    ]);

    if (existingRows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No ZIP reference data loaded yet — click \"Load Nationwide ZIP Data\" first.",
        },
        { status: 409 },
      );
    }

    const rows: UpsertZipCodeReferenceInput[] = buildDemographicsUpsertRows(
      existingRows,
      census,
      new Date().toISOString(),
    );

    await upsertConcurrently(rows, 1000, 4);

    return NextResponse.json({
      success: true,
      source: CENSUS_SOURCE_LABEL,
      vintage: census.vintageLabel,
      existingZips: existingRows.length,
      withDemographics: rows.length,
      written: rows.length,
    });
  } catch (error) {
    console.error("[admin/import-demographics] failed:", error);
    const message =
      error instanceof Error && error.name === "TimeoutError"
        ? "Census API did not respond in time — please try again."
        : error instanceof Error
          ? error.message
          : "Import failed";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
