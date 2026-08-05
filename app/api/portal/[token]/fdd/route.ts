import { NextResponse } from "next/server";
import { z } from "zod";
import { requireLead } from "@/lib/portal/api";
import { getStore } from "@/lib/store";
import { requestFdd, effectiveFddStatus } from "@/lib/fdd/workflow";
import { rateLimit, clientIpFrom } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const fddRequestSchema = z.object({
  /** The prospect must confirm contact accuracy and electronic-delivery consent. */
  consentConfirmed: z.literal(true),
});

/**
 * Prospect-initiated FDD request. Only reachable after the questionnaire is
 * complete, and idempotent: repeat calls (double clicks, refreshes) never
 * create a second document send.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  const { token } = await params;
  const resolved = await requireLead(token);
  if ("response" in resolved) return resolved.response;
  const { lead } = resolved;

  if (!rateLimit(`fdd:${lead.id}`, 5, 60_000)) {
    return NextResponse.json(
      { success: false, error: "Too many requests. Please wait a moment and try again." },
      { status: 429 },
    );
  }

  const questionnaire = await getStore().getQuestionnaire(lead.id);
  const questionnaireCompleted = Boolean(questionnaire) || Boolean(lead.questionnaire_completed_at);
  if (!questionnaireCompleted) {
    return NextResponse.json(
      { success: false, error: "Please complete the qualification questionnaire first." },
      { status: 403 },
    );
  }

  if (!lead.email) {
    return NextResponse.json(
      {
        success: false,
        error:
          "We do not have an email address on file for you. Please contact your advisor to update your contact information.",
      },
      { status: 422 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const parsed = fddRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Please confirm your contact information and consent to continue." },
      { status: 400 },
    );
  }

  try {
    const result = await requestFdd(lead, {
      source: "prospect_dashboard",
      actor: "prospect",
      ip: clientIpFrom(request),
    });

    if (!result.ok) {
      // The failure is recorded for the admin team; the prospect gets a calm
      // message rather than integration internals.
      return NextResponse.json({
        success: true,
        fdd: {
          status: result.lead.fdd_status,
          requestedAt: result.lead.fdd_requested_at,
        },
        message:
          "Your request was received. Our team is processing it and will follow up by email shortly.",
      });
    }

    return NextResponse.json({
      success: true,
      alreadyRequested: result.alreadyRequested,
      fdd: {
        status: effectiveFddStatus(result.lead),
        requestedAt: result.lead.fdd_requested_at,
      },
    });
  } catch (error) {
    console.error("[fdd] request failed:", error);
    return NextResponse.json(
      { success: false, error: "Your request could not be submitted. Please try again." },
      { status: 500 },
    );
  }
}
