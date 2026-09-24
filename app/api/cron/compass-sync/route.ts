import { NextResponse } from "next/server";
import { authorizedCron } from "@/lib/config/cron";
import { runIntelligenceSync } from "@/lib/ghl/intelligence/sync";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
export async function GET(request: Request) {
  if (!authorizedCron(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await runIntelligenceSync());
}
