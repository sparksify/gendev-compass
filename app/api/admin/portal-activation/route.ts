import { NextResponse } from "next/server";
import { getAdminTestPassword, isProduction } from "@/lib/config/env";
import { getStore } from "@/lib/store";
import { isTimeMatchingEnabled } from "@/lib/config/portalActivation";
import type { ExternalLeadRecord, PortalActivationRecord } from "@/types/portalActivation";

export const dynamic = "force-dynamic";

/** Same auth model as the FDD/asset admin views: header password, required in production. */
function authorized(request: Request): boolean {
  const adminPassword = getAdminTestPassword();
  const provided = request.headers.get("x-admin-password");
  if (adminPassword) return provided === adminPassword;
  return !isProduction();
}

/**
 * Redacted view of an external lead: enough to diagnose a matching failure
 * (brand, source, form, timestamps, claim state) without the phone/email
 * that would let one admin view double as a lookup on a real person.
 */
function summarizeExternalLead(lead: ExternalLeadRecord) {
  return {
    id: lead.id,
    brand_slug: lead.brand_slug,
    source: lead.source,
    facebook_form_id: lead.facebook_form_id,
    facebook_campaign_id: lead.facebook_campaign_id,
    facebook_ad_id: lead.facebook_ad_id,
    facebook_page_id: lead.facebook_page_id,
    phone_last_four: lead.phone_last_four,
    has_email: Boolean(lead.normalized_email),
    submitted_at: lead.submitted_at,
    received_at: lead.received_at,
    claimed_at: lead.claimed_at,
    claimed_by_activation_id: lead.claimed_by_activation_id,
    matched_lead_id: lead.matched_lead_id,
  };
}

function summarizeActivation(activation: PortalActivationRecord) {
  return {
    id: activation.id,
    brand_slug: activation.brand_slug,
    source: activation.source,
    facebook_form_id: activation.facebook_form_id,
    status: activation.status,
    last_match_tier: activation.last_match_tier,
    last_candidate_count: activation.last_candidate_count,
    last_failure_reason: activation.last_failure_reason,
    fallback_attempts: activation.fallback_attempts,
    matched_external_lead_id: activation.matched_external_lead_id,
    portal_lead_id: activation.portal_lead_id,
    created_at: activation.created_at,
    updated_at: activation.updated_at,
    expires_at: activation.expires_at,
  };
}

/**
 * Diagnostics for the activation flow (spec: admin/debug view). Shows lead
 * arrival vs. activation arrival, the matching tier used, candidate counts,
 * and outcome — never phone numbers, emails, or HighLevel ids.
 */
export async function GET(request: Request): Promise<NextResponse> {
  if (!authorized(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const store = getStore();
  const [activations, externalLeads] = await Promise.all([
    store.listRecentActivations(100),
    store.listRecentExternalLeads(100),
  ]);

  const total = activations.length;
  const ready = activations.filter((a) => a.status === "ready").length;
  const autoMatched = activations.filter(
    (a) => a.status === "ready" && a.last_match_tier !== "last_four",
  ).length;
  const fallbackUsed = activations.filter((a) => a.last_match_tier === "last_four").length;

  return NextResponse.json({
    success: true,
    config: { timeMatchingEnabled: isTimeMatchingEnabled() },
    summary: {
      totalActivations: total,
      readyCount: ready,
      autoMatchedCount: autoMatched,
      lastFourResolvedCount: fallbackUsed,
      autoMatchSuccessRate: total > 0 ? Math.round((autoMatched / total) * 100) : null,
    },
    activations: activations.map(summarizeActivation),
    externalLeads: externalLeads.map(summarizeExternalLead),
  });
}
