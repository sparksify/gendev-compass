import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { generatePortalToken } from "@/lib/portal/tokens";
import { trackEvent } from "@/lib/portal/events";
import { createLeadSchema } from "@/lib/validation/lead";
import { getAdminTestPassword, getAppUrl, getInternalApiKey, isProduction } from "@/lib/config/env";
import { clientIpFrom, rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

/**
 * Creates a lead and returns its portal URL. Called by internal automation
 * (API key) or the internal testing page (admin password). Facebook webhook
 * ingestion is out of scope for the MVP but will target this same endpoint.
 */
export async function POST(request: Request): Promise<NextResponse> {
  if (!rateLimit(`leads:${clientIpFrom(request)}`, 20, 60_000)) {
    return NextResponse.json(
      { success: false, error: "Too many requests. Please try again shortly." },
      { status: 429 },
    );
  }

  if (!isAuthorized(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
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
      source: input.source ?? null,
      campaign: input.campaign ?? null,
      ad_set: input.adSet ?? null,
      ad: input.ad ?? null,
      facebook_lead_id: input.facebookLeadId ?? null,
      initial_liquid_capital: input.liquidCapital ?? null,
      initial_net_worth: input.netWorth ?? null,
      initial_business_owner: input.ownedBusinessBefore ?? null,
    });

    await trackEvent(lead, "lead_created", { source: lead.source });

    return NextResponse.json({
      success: true,
      leadId: lead.id,
      portalUrl: `${getAppUrl()}/p/${lead.portal_token}`,
    });
  } catch (error) {
    console.error("[leads] creation failed:", error);
    return NextResponse.json(
      { success: false, error: "Lead creation failed. Please try again." },
      { status: 500 },
    );
  }
}

function isAuthorized(request: Request): boolean {
  const apiKey = getInternalApiKey();
  const providedKey = request.headers.get("x-api-key");
  if (apiKey && providedKey && timingSafeEquals(providedKey, apiKey)) return true;

  const adminPassword = getAdminTestPassword();
  const providedPassword = request.headers.get("x-admin-password");
  if (adminPassword && providedPassword && timingSafeEquals(providedPassword, adminPassword)) {
    return true;
  }

  // Development convenience: allow unauthenticated creation only when no
  // credentials are configured at all, and never in production.
  if (!apiKey && !adminPassword && !isProduction()) return true;

  return false;
}

function timingSafeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
