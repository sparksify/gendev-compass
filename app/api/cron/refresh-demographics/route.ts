import { NextResponse } from "next/server";
import { authorizedCron } from "@/lib/config/cron";
import { getCensusDataHealth, reconcileCensusImportState } from "@/lib/geocoding/censusHealth";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Scheduled (see vercel.json) Census data health check — the authoritative
 * guarantee behind "no human has to notice empty data and click a
 * button." This route does no fetching or writing of Census data itself;
 * it's a cheap, fast check that either resumes a stuck job (the worker's
 * self-chain broke) or starts a new one if the current ACS vintage has
 * never been fully imported, then returns. All the actual work happens in
 * /api/cron/census-worker, chunk by chunk, independent of this route and
 * of any browser. Runs daily — ACS releases are annual, so daily is about
 * detecting a broken/stuck state promptly, not about how often new Census
 * data actually appears.
 */
export async function GET(request: Request): Promise<NextResponse> {
  if (!authorizedCron(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const health = await getCensusDataHealth();
    const result = await reconcileCensusImportState("cron", health);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("[cron/refresh-demographics] health check failed:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Health check failed" },
      { status: 500 },
    );
  }
}
