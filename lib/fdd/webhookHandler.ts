import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getFddWebhookSecret } from "@/lib/config/fdd";
import { isProduction } from "@/lib/config/env";
import { applyFddProviderEvent, type FddProviderEventName } from "@/lib/fdd/workflow";
import { rateLimit, clientIpFrom } from "@/lib/rateLimit";

/**
 * Shared handler for inbound FDD provider webhooks (GoHighLevel workflow
 * confirmations and document-provider envelope events). Verifies the HMAC
 * signature over the raw body before anything is parsed or trusted.
 */

const providerEventSchema = z.object({
  event: z.enum(["fdd_sent", "fdd_delivered", "fdd_received"]),
  prospect_id: z.string().trim().max(100).optional(),
  envelope_id: z.string().trim().max(300).optional(),
  event_id: z.string().trim().max(300).optional(),
  sent_at: z.string().datetime().optional(),
  delivered_at: z.string().datetime().optional(),
  received_at: z.string().datetime().optional(),
  timestamp: z.string().datetime().optional(),
  status: z.string().trim().max(100).optional(),
});

function verifySignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = getFddWebhookSecret();
  if (!secret) {
    // Without a shared secret, signed webhooks cannot be verified. Never
    // accept unsigned events in production; allow local testing without one.
    return !isProduction();
  }
  if (!signatureHeader) return false;

  const provided = signatureHeader.replace(/^sha256=/, "").trim();
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const providedBuffer = Buffer.from(provided, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  if (providedBuffer.length !== expectedBuffer.length || providedBuffer.length === 0) return false;
  return timingSafeEqual(providedBuffer, expectedBuffer);
}

export async function handleFddWebhook(
  request: Request,
  /** When set, only this event type is accepted (the /received endpoint). */
  expectedEvent?: FddProviderEventName,
): Promise<NextResponse> {
  const ip = clientIpFrom(request);
  if (!rateLimit(`fdd-webhook:${ip}`, 60, 60_000)) {
    return NextResponse.json({ success: false, error: "Rate limited" }, { status: 429 });
  }

  const rawBody = await request.text();
  if (!verifySignature(rawBody, request.headers.get("x-fdd-signature"))) {
    return NextResponse.json({ success: false, error: "Invalid signature" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = providerEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid payload" }, { status: 400 });
  }
  const payload = parsed.data;

  if (expectedEvent && payload.event !== expectedEvent) {
    return NextResponse.json(
      { success: false, error: `This endpoint only accepts ${expectedEvent} events` },
      { status: 400 },
    );
  }

  try {
    const result = await applyFddProviderEvent(
      {
        event: payload.event,
        prospect_id: payload.prospect_id ?? null,
        envelope_id: payload.envelope_id ?? null,
        event_id: payload.event_id ?? null,
        timestamp:
          payload.received_at ?? payload.delivered_at ?? payload.sent_at ?? payload.timestamp ?? null,
        status: payload.status ?? null,
      },
      ip,
    );

    return NextResponse.json(
      { success: result.ok, duplicate: result.duplicate, error: result.error },
      { status: result.httpStatus },
    );
  } catch (error) {
    console.error(`[fdd] webhook processing failed for ${payload.event}:`, error);
    return NextResponse.json(
      { success: false, error: "Event could not be processed" },
      { status: 500 },
    );
  }
}
