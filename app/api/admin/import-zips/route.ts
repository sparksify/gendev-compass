import { NextResponse } from "next/server";
import { getAdminTestPassword, isProduction } from "@/lib/config/env";
import { clientIpFrom, rateLimit } from "@/lib/rateLimit";
import { refreshZipReference } from "@/lib/geocoding/zipImport";

export const dynamic = "force-dynamic";
/** The import runs ~15–40s (download + ~41 batched upserts). */
export const maxDuration = 60;

/** Same auth model as the other admin routes: header password, required in production. */
function authorized(request: Request): boolean {
  const adminPassword = getAdminTestPassword();
  const provided = request.headers.get("x-admin-password");
  if (adminPassword) return provided === adminPassword;
  return !isProduction();
}

/**
 * Loads the nationwide GeoNames ZIP reference into zip_code_reference.
 * All download/parsing happens in this serverless function; the database
 * only receives batched upserts through the store layer — bulk work never
 * runs inside Postgres (see docs/territory-advisor.md).
 *
 * Idempotent: upserts by zip_code; safe to run repeatedly.
 */
export async function POST(request: Request): Promise<NextResponse> {
  if (!rateLimit(`import-zips:${clientIpFrom(request)}`, 3, 60_000)) {
    return NextResponse.json({ success: false, error: "Too many requests" }, { status: 429 });
  }
  if (!authorized(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await refreshZipReference();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("[admin/import-zips] failed:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Import failed" },
      { status: 500 },
    );
  }
}
