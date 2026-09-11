import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { generatePortalToken } from "@/lib/portal/tokens";
import { trackEvent } from "@/lib/portal/events";
import { recordLeadEvent } from "@/lib/domain/activities";
import { ensureLeadDomainChain } from "@/lib/domain/chain";
import { getAppUrl, getCalendarEmbedUrl } from "@/lib/config/env";
import { clientIpFrom, rateLimit } from "@/lib/rateLimit";
import { buildFirstTouchFields, parseAttributionFromUrl } from "@/lib/tracking/attribution";
import { LIQUID_CAPITAL_RANGES } from "@/types/questionnaire";
import {
  BRIDGE_ASSESSMENT_VERSION,
  answerSnapshot,
  assessFit,
  bridgeAssessmentSchema,
} from "@/lib/bridge/assessment";

export const dynamic = "force-dynamic";

/**
 * Public submit endpoint for the bridge page's fit assessment (/watch).
 * Unlike POST /api/leads (internal automation, API key) this is reachable
 * by the prospect's browser, so it is rate limited per IP, carries a
 * honeypot, and accepts only the assessment's own fixed shape.
 *
 * A submission creates the lead (source "bridge"), stores every answer on
 * the lead's event history, seeds the portal questionnaire draft with the
 * location so the prospect never types it twice, and returns the personal
 * portal link plus the fit call that orders the completion screen.
 */

function requestOrigin(request: Request): string | null {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) return null;
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!rateLimit(`bridge:${clientIpFrom(request)}`, 5, 10 * 60_000)) {
    return NextResponse.json(
      { success: false, error: "Too many submissions. Please try again in a few minutes." },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bridgeAssessmentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid payload", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const input = parsed.data;
  const scheduleUrl = getCalendarEmbedUrl();

  // Honeypot filled → a bot. Answer as if it worked, create nothing.
  if (input.website) {
    return NextResponse.json({
      success: true,
      firstName: input.firstName,
      portalUrl: "/start",
      scheduleUrl,
      fit: "standard",
    });
  }

  try {
    const store = getStore();
    const nowIso = new Date().toISOString();
    const fit = assessFit(input);

    const existing = await store.getLeadByEmail(input.email);
    if (existing) {
      console.warn(
        `[bridge] duplicate email on assessment: ${input.email} already belongs to lead ${existing.id}. Creating a separate record — reconcile manually.`,
      );
    }

    const isPortalCapitalRange = LIQUID_CAPITAL_RANGES.some((r) => r.value === input.liquidCapital);
    const signal = parseAttributionFromUrl(input.attribution?.url ?? "", {
      referrer: input.attribution?.referrer ?? null,
      fbp: input.attribution?.fbp ?? null,
      fbc: input.attribution?.fbc ?? null,
    });

    let lead = await store.createLead({
      portal_token: generatePortalToken(),
      first_name: input.firstName,
      last_name: input.lastName,
      email: input.email,
      phone: input.phone,
      state: input.state,
      source: "bridge",
      campaign: null,
      ad_set: null,
      ad: null,
      facebook_lead_id: null,
      initial_liquid_capital: isPortalCapitalRange ? input.liquidCapital : null,
      initial_net_worth: null,
      initial_business_owner: null,
      ...buildFirstTouchFields(signal, nowIso),
    });

    // Location → portal questionnaire draft, so the prospect never retypes
    // it. Only keys the draft schema knows; liquid capital only when it is
    // one of the questionnaire's own ranges.
    try {
      lead = await store.updateLead(lead.id, {
        questionnaire_draft: {
          city: input.city,
          state: input.state,
          postalCode: input.zip,
          ...(isPortalCapitalRange ? { liquidCapital: input.liquidCapital } : {}),
        },
        questionnaire_draft_saved_at: nowIso,
      });
    } catch (draftError) {
      console.error(`[bridge] draft seed failed for lead ${lead.id}:`, draftError);
    }

    try {
      const chain = await ensureLeadDomainChain(lead);
      lead = chain.lead;
    } catch (chainError) {
      console.error(
        `[bridge] domain chain creation failed for lead ${lead.id} (will self-repair on portal load):`,
        chainError,
      );
    }

    // Full answers stay first-party (Supabase only) — the same rule the
    // portal questionnaire follows, so recordLeadEvent rather than
    // trackEvent, which forwards event data to analytics/advertising.
    try {
      await recordLeadEvent(lead, "bridge_assessment_submitted", {
        version: BRIDGE_ASSESSMENT_VERSION,
        fit,
        videoPercent: input.videoPercent ?? null,
        answers: answerSnapshot(input),
      });
    } catch (eventError) {
      console.error(`[bridge] failed to store assessment answers for lead ${lead.id}:`, eventError);
    }

    // Coarse conversion signal only — no financial answers leave the portal.
    await trackEvent(lead, "lead_created", {
      source: "bridge",
      fit,
      videoPercent: input.videoPercent ?? null,
      ...(existing ? { duplicateEmailOfLeadId: existing.id } : {}),
    });

    return NextResponse.json({
      success: true,
      firstName: lead.first_name,
      portalUrl: `${requestOrigin(request) ?? getAppUrl()}/p/${lead.portal_token}`,
      scheduleUrl,
      fit,
    });
  } catch (error) {
    console.error("[bridge] assessment submission failed:", error);
    return NextResponse.json(
      { success: false, error: "Something went wrong saving your answers. Please try again." },
      { status: 500 },
    );
  }
}
