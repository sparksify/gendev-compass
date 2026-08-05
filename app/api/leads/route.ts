import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { generatePortalToken } from "@/lib/portal/tokens";
import { trackEvent } from "@/lib/portal/events";
import { createLeadSchema } from "@/lib/validation/lead";
import { ensureLeadDomainChain, type LeadDomainChain } from "@/lib/domain/chain";
import { upsertMapping } from "@/lib/domain/mappings";
import { getAdminTestPassword, getAppUrl, getInternalApiKey, isProduction } from "@/lib/config/env";
import { clientIpFrom, rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

/**
 * The origin the caller actually used (e.g. https://www.gendevcompass.com),
 * so generated portal links always match the serving domain. Falls back to
 * NEXT_PUBLIC_APP_URL for non-HTTP contexts.
 */
function requestOrigin(request: Request): string | null {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) return null;
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

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
    const store = getStore();

    // Duplicate guard: email is a matching aid, not a merge key. A repeat
    // submission is logged for the team to reconcile — never auto-merged.
    const existing = await store.getLeadByEmail(input.email);
    if (existing) {
      console.warn(
        `[leads] duplicate email on lead creation: ${input.email} already belongs to lead ${existing.id}. Creating a separate record — reconcile manually.`,
      );
    }

    let lead = await store.createLead({
      portal_token: generatePortalToken(),
      first_name: input.firstName,
      last_name: input.lastName,
      email: input.email,
      phone: input.phone ?? null,
      state: input.state ?? null,
      source: input.source ?? null,
      campaign: input.campaign ?? null,
      ad_set: input.adSet ?? null,
      ad: input.ad ?? null,
      facebook_lead_id: input.facebookLeadId ?? null,
      initial_liquid_capital: input.liquidCapital ?? null,
      initial_net_worth: input.netWorth ?? null,
      initial_business_owner: input.ownedBusinessBefore ?? null,
    });

    // Optional pre-assignment: only an existing, active staff user is
    // accepted — the caller-supplied ID is verified, never trusted.
    if (input.assignedAdvisorId) {
      const advisor = await store.getStaffUserById(input.assignedAdvisorId);
      if (advisor?.active) {
        lead = await store.updateLead(lead.id, { assigned_advisor_id: advisor.id });
      } else {
        console.warn(`[leads] ignoring unknown assignedAdvisorId ${input.assignedAdvisorId}`);
      }
    }

    // Build the domain chain: organization → brand → client → opportunity.
    // supabase-js has no multi-statement transactions, so this runs as
    // sequential idempotent get-or-create steps; on failure the lead still
    // exists and the chain is repaired on the next portal load
    // (ensureLeadDomainChain is the same code path).
    let chain: LeadDomainChain | null = null;
    try {
      chain = await ensureLeadDomainChain(lead, {
        organizationSlug: input.organizationSlug ?? null,
        brandSlug: input.brandSlug ?? null,
      });
      lead = chain.lead;

      await registerExternalMappings(chain, {
        facebookLeadId: input.facebookLeadId ?? null,
        externalContactId: input.externalContactId ?? null,
        externalOpportunityId: input.externalOpportunityId ?? null,
      });
    } catch (chainError) {
      console.error(
        `[leads] domain chain creation failed for lead ${lead.id} (will self-repair on portal load):`,
        chainError,
      );
    }

    await trackEvent(lead, "lead_created", {
      source: lead.source,
      ...(existing ? { duplicateEmailOfLeadId: existing.id } : {}),
    });

    return NextResponse.json({
      success: true,
      leadId: lead.id,
      portalUrl: `${requestOrigin(request) ?? getAppUrl()}/p/${lead.portal_token}`,
    });
  } catch (error) {
    console.error("[leads] creation failed:", error);
    return NextResponse.json(
      { success: false, error: "Lead creation failed. Please try again." },
      { status: 500 },
    );
  }
}

/**
 * Registers provider ID mappings for a freshly created lead. Mapping
 * failures are logged, never fatal — the legacy columns
 * (leads.facebook_lead_id) still carry the IDs.
 */
async function registerExternalMappings(
  chain: LeadDomainChain,
  ids: {
    facebookLeadId: string | null;
    externalContactId: string | null;
    externalOpportunityId: string | null;
  },
): Promise<void> {
  const jobs: Array<Promise<unknown>> = [];
  if (ids.facebookLeadId) {
    jobs.push(
      upsertMapping({
        organization_id: chain.organization.id,
        provider: "facebook",
        entity_type: "lead",
        internal_entity_id: chain.lead.id,
        external_id: ids.facebookLeadId,
      }),
    );
  }
  if (ids.externalContactId) {
    jobs.push(
      upsertMapping({
        organization_id: chain.organization.id,
        provider: "gohighlevel",
        entity_type: "client",
        internal_entity_id: chain.client.id,
        external_id: ids.externalContactId,
      }),
    );
  }
  if (ids.externalOpportunityId) {
    jobs.push(
      upsertMapping({
        organization_id: chain.organization.id,
        provider: "gohighlevel",
        entity_type: "opportunity",
        internal_entity_id: chain.opportunity.id,
        external_id: ids.externalOpportunityId,
      }),
    );
  }
  const results = await Promise.allSettled(jobs);
  for (const result of results) {
    if (result.status === "rejected") {
      console.error("[leads] external mapping failed:", result.reason);
    }
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
