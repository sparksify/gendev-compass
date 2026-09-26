import { NextResponse } from "next/server";
import { requireLead } from "@/lib/portal/api";
import { getCalendarEmbedUrl } from "@/lib/config/env";
import { clientIpFrom, rateLimit } from "@/lib/rateLimit";
import { knownLeadAssessmentSchema } from "@/lib/bridge/assessment";
import { applyAssessmentToLead } from "@/lib/bridge/lead";
import { bridgeCapitalBand } from "@/lib/config/qualification";

export const dynamic = "force-dynamic";

/**
 * Fit assessment submit for a prospect who arrived through their own link
 * (/watch/[token]). The lead already exists — Facebook → automation →
 * POST /api/leads → /start handoff — so nothing is created; the answers are
 * attached to that record and the prospect is sent on to the portal the
 * same token opens.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  const { token } = await params;

  if (!rateLimit(`bridge:${clientIpFrom(request)}`, 10, 10 * 60_000)) {
    return NextResponse.json(
      { success: false, error: "Too many submissions. Please try again in a few minutes." },
      { status: 429 },
    );
  }

  const resolved = await requireLead(token);
  if ("response" in resolved) return resolved.response;
  const { lead } = resolved;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = knownLeadAssessmentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid payload", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const applied = await applyAssessmentToLead(lead, parsed.data);
    const capitalBand = bridgeCapitalBand(parsed.data.liquidCapital);
    const nextUrl = capitalBand === "50k-plus"
      ? `/webinar/${applied.lead.portal_token}`
      : capitalBand === "25k-49k" || capitalBand === "unknown"
        ? `/p/${applied.lead.portal_token}/financial-clarification`
        : `/webinar/${applied.lead.portal_token}`;
    return NextResponse.json({
      success: true,
      firstName: applied.lead.first_name,
      token: applied.lead.portal_token,
      portalUrl: `/p/${applied.lead.portal_token}`,
      nextUrl,
      scheduleUrl: getCalendarEmbedUrl(),
      fit: applied.fit,
    });
  } catch (error) {
    console.error(`[bridge] assessment failed for lead ${lead.id}:`, error);
    return NextResponse.json(
      { success: false, error: "Something went wrong saving your answers. Please try again." },
      { status: 500 },
    );
  }
}
