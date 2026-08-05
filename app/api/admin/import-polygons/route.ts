import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminTestPassword, isProduction } from "@/lib/config/env";
import { clientIpFrom, rateLimit } from "@/lib/rateLimit";
import { refreshStatePolygons, SUPPORTED_POLYGON_STATES } from "@/lib/territory/polygonImport";

export const dynamic = "force-dynamic";
/** One state per invocation: download + simplify + ~10 batched upserts. */
export const maxDuration = 60;

const bodySchema = z.object({
  state: z
    .string()
    .trim()
    .toUpperCase()
    .refine((s) => SUPPORTED_POLYGON_STATES.includes(s), "Unsupported state code"),
});

/** Same auth model as the other admin routes: header password, required in production. */
function authorized(request: Request): boolean {
  const adminPassword = getAdminTestPassword();
  const provided = request.headers.get("x-admin-password");
  if (adminPassword) return provided === adminPassword;
  return !isProduction();
}

/**
 * Loads one state's ZCTA boundary polygons into zip_code_geographies.geojson.
 * Download, parse, and simplification run in this serverless function; the
 * database receives only batched upserts (docs/territory-advisor.md).
 * Idempotent per state; safe to re-run.
 */
export async function POST(request: Request): Promise<NextResponse> {
  if (!rateLimit(`import-polygons:${clientIpFrom(request)}`, 6, 60_000)) {
    return NextResponse.json({ success: false, error: "Too many requests" }, { status: 429 });
  }
  if (!authorized(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid payload", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const result = await refreshStatePolygons(parsed.data.state);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("[admin/import-polygons] failed:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Import failed" },
      { status: 500 },
    );
  }
}
