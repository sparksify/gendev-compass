import { NextResponse } from "next/server";
import { z } from "zod";
import { requireLead } from "@/lib/portal/api";
import { getStore } from "@/lib/store";
import { trackEvent } from "@/lib/portal/events";
import { clientIpFrom, rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const fddRequestSchema = z.object({
  resend: z.boolean().optional(),
});

/**
 * Records the prospect's request for an electronic copy of the Franchise
 * Disclosure Document.
 *
 * INTEGRATION POINT: actual email delivery (and the e-signature /
 * acknowledgment flow that stamps fdd_acknowledged_at and starts the review
 * period) is handled by the document provider once connected. This endpoint
 * records the request server-side so the send can be triggered by that
 * integration; the `fdd_email_sent` event is reserved for it and is not
 * emitted here.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  if (!rateLimit(`fdd:${clientIpFrom(request)}`, 5, 60_000)) {
    return NextResponse.json(
      { success: false, error: "Please wait a moment before trying again." },
      { status: 429 },
    );
  }

  const { token } = await params;
  const resolved = await requireLead(token);
  if ("response" in resolved) return resolved.response;
  const { lead } = resolved;

  const store = getStore();

  const questionnaireCompleted =
    Boolean(lead.questionnaire_completed_at) || Boolean(await store.getQuestionnaire(lead.id));
  if (!questionnaireCompleted) {
    return NextResponse.json(
      { success: false, error: "Please complete the questionnaire first." },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const parsed = fddRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid payload" }, { status: 400 });
  }

  const isResend = Boolean(parsed.data.resend) && Boolean(lead.fdd_requested_at);
  const now = new Date().toISOString();

  try {
    if (!lead.fdd_requested_at) {
      await store.updateLead(lead.id, { fdd_requested_at: now });
    }
    await trackEvent(lead, "fdd_requested", { resend: isResend }, "schedule");

    return NextResponse.json({
      success: true,
      email: lead.email,
      requestedAt: lead.fdd_requested_at ?? now,
      acknowledgedAt: lead.fdd_acknowledged_at,
    });
  } catch (error) {
    console.error("[fdd] request failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Your request could not be recorded. Please try again.",
      },
      { status: 500 },
    );
  }
}
