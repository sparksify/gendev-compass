import { NextResponse } from "next/server";
import { authorizedCron } from "@/lib/config/cron";
import { runCensusImportChunk } from "@/lib/geocoding/censusJob";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * The actual Census import worker — runs entirely server-side, chunk by
 * chunk, chaining its own continuation (see lib/geocoding/censusJob.ts)
 * until the job finishes. Never called directly by a browser: only by
 * enqueueCensusImportJob (starting a job) and its own self-scheduled
 * continuation, both authenticated the same way Vercel Cron requests are
 * (CRON_SECRET as a Bearer token) — this route has no browser-facing
 * caller and no client-side loop drives it.
 */
export async function POST(request: Request): Promise<NextResponse> {
  if (!authorizedCron(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const jobId = body?.jobId;
  if (typeof jobId !== "string" || !jobId) {
    return NextResponse.json({ success: false, error: "Missing jobId" }, { status: 400 });
  }

  try {
    const result = await runCensusImportChunk(jobId);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("[cron/census-worker] chunk failed:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Worker failed" },
      { status: 500 },
    );
  }
}
