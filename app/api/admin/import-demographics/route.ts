import { NextResponse } from "next/server";
import { getAdminTestPassword, isProduction } from "@/lib/config/env";
import { clientIpFrom, rateLimit } from "@/lib/rateLimit";
import { downloadAndParseZipData } from "@/lib/geocoding/zipImport";
import { CENSUS_SOURCE_LABEL, downloadCensusDemographics } from "@/lib/geocoding/censusImport";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";
/** GeoNames + two ACS downloads + ~41 batched upserts. */
export const maxDuration = 60;

/** Same auth model as the other admin routes: header password, required in production. */
function authorized(request: Request): boolean {
  const adminPassword = getAdminTestPassword();
  const provided = request.headers.get("x-admin-password");
  if (adminPassword) return provided === adminPassword;
  return !isProduction();
}

/**
 * Loads real Census ACS demographics (population, households, median income,
 * 5-year growth) onto the nationwide ZIP reference. Downloads GeoNames and
 * the ACS tables in this serverless function, merges them in memory, and
 * writes complete rows through the store layer in batches — bulk work never
 * runs inside Postgres (see docs/territory-advisor.md).
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
    const [geoRows, census] = await Promise.all([
      downloadAndParseZipData(),
      downloadCensusDemographics(),
    ]);

    const now = new Date().toISOString();
    let withDemographics = 0;
    const rows = geoRows.map((row) => {
      const demo = census.demographics.get(row.zip_code);
      if (!demo) return row;
      withDemographics += 1;
      return {
        ...row,
        population: demo.population,
        households: demo.households,
        median_household_income: demo.medianHouseholdIncome,
        population_growth_pct: demo.populationGrowthPct,
        demographics_source: CENSUS_SOURCE_LABEL,
        demographics_vintage: census.vintageLabel,
        updated_at: now,
      };
    });

    const store = getStore();
    const BATCH = 1000;
    let written = 0;
    for (let i = 0; i < rows.length; i += BATCH) {
      await store.upsertZipCodeReferences(rows.slice(i, i + BATCH));
      written += Math.min(BATCH, rows.length - i);
    }
    return NextResponse.json({
      success: true,
      source: CENSUS_SOURCE_LABEL,
      vintage: census.vintageLabel,
      parsed: rows.length,
      withDemographics,
      written,
    });
  } catch (error) {
    console.error("[admin/import-demographics] failed:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Import failed" },
      { status: 500 },
    );
  }
}
