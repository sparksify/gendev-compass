import type { NextResponse } from "next/server";
import { handleFddWebhook } from "@/lib/fdd/webhookHandler";

export const dynamic = "force-dynamic";

/**
 * General FDD callback endpoint (the `callback_url` shared with GoHighLevel):
 * accepts fdd_sent, fdd_delivered, and fdd_received events.
 */
export async function POST(request: Request): Promise<NextResponse> {
  return handleFddWebhook(request);
}
