import { NextResponse } from "next/server";
import { authorizedCron } from "@/lib/config/cron";
import { refreshZipReference } from "@/lib/geocoding/zipImport";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Scheduled (see vercel.json) refresh of the nationwide GeoNames ZIP
 * reference — the automated counterpart to the "Load Nationwide ZIP Data"
 * admin button, which remains available as a manual override. Same
 * underlying logic (lib/geocoding/zipImport.ts, refreshZipReference);
 * idempotent, safe to run repeatedly.
 */
export async function GET(request: Request): Promise<NextResponse> {
  if (!authorizedCron(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await refreshZipReference();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("[cron/refresh-zip-data] failed:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Refresh failed" },
      { status: 500 },
    );
  }
}
