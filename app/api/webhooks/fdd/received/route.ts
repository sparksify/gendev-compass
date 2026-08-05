import type { NextResponse } from "next/server";
import { handleFddWebhook } from "@/lib/fdd/webhookHandler";

export const dynamic = "force-dynamic";

/**
 * Document-provider acknowledgment webhook (spec §5): records the signed or
 * received FDD, starts the waiting period, and calculates eligibility.
 */
export async function POST(request: Request): Promise<NextResponse> {
  return handleFddWebhook(request, "fdd_received");
}
