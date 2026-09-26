import { createHash, randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { generatePortalToken } from "@/lib/portal/tokens";
import { trackEvent } from "@/lib/portal/events";
import { ensureLeadDomainChain } from "@/lib/domain/chain";
import { getAppUrl, getCalendarEmbedUrl } from "@/lib/config/env";
import { clientIpFrom, rateLimit } from "@/lib/rateLimit";
import { buildFirstTouchFields, parseAttributionFromUrl } from "@/lib/tracking/attribution";
import { LIQUID_CAPITAL_RANGES } from "@/types/questionnaire";
import { bridgeAssessmentSchema } from "@/lib/bridge/assessment";
import { applyAssessmentToLead } from "@/lib/bridge/lead";
import { applyVideoProgress } from "@/lib/portal/progress";
import { getBridgeWistiaMediaId } from "@/lib/config/bridge";
import { bridgeCapitalBand } from "@/lib/config/qualification";

export const dynamic = "force-dynamic";

/**
 * Public submit endpoint for the anonymous bridge page (/watch — cold
 * traffic with no lead on file). Unlike POST /api/leads (internal
 * automation, API key) this is reachable by the prospect's browser, so it
 * is rate limited per IP, carries a honeypot, and accepts only the
 * assessment's own fixed shape.
 *
 * Creates the lead (source "bridge") with first-touch attribution, then
 * attaches the assessment exactly as the tokenized route does
 * (lib/bridge/lead.ts). Prospects who arrive through their own link use
 * POST /api/bridge/[token]/assessment instead — no second lead.
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
      nextUrl: "/start",
      scheduleUrl,
      fit: "standard",
    });
  }

  try {
    const store = getStore();
    const nowIso = new Date().toISOString();

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
      bridge_submission_key: createHash("sha256").update(JSON.stringify([input.submissionId ?? randomUUID(), input.firstName, input.lastName, input.email, input.phone, input.goal, input.role, input.timeline, input.city, input.state, input.zip, input.investmentLevel, input.liquidCapital, input.priority, input.notes ?? ""])).digest("hex"),
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

    try {
      lead = (await ensureLeadDomainChain(lead)).lead;
    } catch (chainError) {
      console.error(
        `[bridge] domain chain creation failed for lead ${lead.id} (will self-repair on portal load):`,
        chainError,
      );
    }

    // Coarse conversion signal only — no financial answers leave the portal.
    if (!(await store.getEventsForLead(lead.id)).some(e => e.event_name === "lead_created")) await trackEvent(lead, "lead_created", {
      source: "bridge",
      ...(existing ? { duplicateEmailOfLeadId: existing.id } : {}),
    });

    // Whatever they watched before the lead existed counts as the Investor
    // Overview, exactly as it would have on /watch/[token].
    if (input.video && input.video.duration > 0) {
      try {
        await applyVideoProgress(lead, {
          ...input.video,
          eventType: "heartbeat",
          mediaId: getBridgeWistiaMediaId(),
        });
      } catch (videoError) {
        console.error(`[bridge] could not apply pre-submit video progress for lead ${lead.id}:`, videoError);
      }
    }

    const applied = await applyAssessmentToLead(lead, input);
    lead = applied.lead;
    const nextUrl = bridgeCapitalBand(input.liquidCapital) === "50k-plus"
      ? `/p/${lead.portal_token}/questionnaire`
      : `/webinar/${lead.portal_token}`;

    return NextResponse.json({
      success: true,
      firstName: lead.first_name,
      token: lead.portal_token,
      portalUrl: `${requestOrigin(request) ?? getAppUrl()}/p/${lead.portal_token}`,
      nextUrl,
      scheduleUrl,
      fit: applied.fit,
    });
  } catch (error) {
    console.error("[bridge] assessment submission failed:", error);
    return NextResponse.json(
      { success: false, error: "Something went wrong saving your answers. Please try again." },
      { status: 500 },
    );
  }
}
