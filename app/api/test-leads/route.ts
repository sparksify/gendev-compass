import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { generatePortalToken } from "@/lib/portal/tokens";
import { trackEvent } from "@/lib/portal/events";
import { createLeadSchema } from "@/lib/validation/lead";
import { getAppUrl } from "@/lib/config/env";
import { clientIpFrom, rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

function requestOrigin(request: Request): string | null {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) return null;
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

/**
 * Unauthenticated lead creation for the /create-lead colleague-testing
 * page. Deliberately open (no admin password) so teammates can generate
 * portal links; the trade-offs are contained: a tight per-IP rate limit,
 * and every lead is force-tagged source=colleague-test so test records
 * are always distinguishable from real ad-driven leads.
 */
export async function POST(request: Request): Promise<NextResponse> {
  if (!rateLimit(`test-leads:${clientIpFrom(request)}`, 5, 60_000)) {
    return NextResponse.json(
      { success: false, error: "Too many requests. Please try again shortly." },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createLeadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid payload", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const input = parsed.data;
  try {
    const lead = await getStore().createLead({
      portal_token: generatePortalToken(),
      first_name: input.firstName,
      last_name: input.lastName,
      email: input.email,
      phone: input.phone ?? null,
      state: input.state ?? null,
      source: "colleague-test",
      campaign: null,
      ad_set: null,
      ad: null,
      facebook_lead_id: null,
      initial_liquid_capital: input.liquidCapital ?? null,
      initial_net_worth: input.netWorth ?? null,
      initial_business_owner: input.ownedBusinessBefore ?? null,
    });

    await trackEvent(lead, "lead_created", { source: lead.source });

    return NextResponse.json({
      success: true,
      leadId: lead.id,
      portalUrl: `${requestOrigin(request) ?? getAppUrl()}/p/${lead.portal_token}`,
    });
  } catch (error) {
    console.error("[test-leads] creation failed:", error);
    return NextResponse.json(
      { success: false, error: "Lead creation failed. Please try again." },
      { status: 500 },
    );
  }
}
