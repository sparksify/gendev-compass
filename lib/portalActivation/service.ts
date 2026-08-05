import { randomBytes } from "crypto";
import { getStore } from "@/lib/store";
import { generatePortalToken } from "@/lib/portal/tokens";
import { getBrandEntry, isValidBrandSlug } from "@/lib/config/brands";
import {
  getActivationMaxWaitSeconds,
  getActivationTtlMinutes,
  getAutoMatchAfterSeconds,
  getAutoMatchBeforeSeconds,
  getLastFourMaxAttempts,
  isTimeMatchingEnabled,
} from "@/lib/config/portalActivation";
import { classifyAutoMatch, classifyLastFourMatch, computeMatchWindow } from "./matching";
import { logActivation } from "./log";
import type { LeadRecord } from "@/types/lead";
import type {
  ActivationCriteria,
  ExternalLeadRecord,
  PortalActivationRecord,
} from "@/types/portalActivation";

export function generateActivationPublicId(): string {
  return randomBytes(24).toString("base64url");
}

function criteriaFromActivation(record: PortalActivationRecord): ActivationCriteria {
  return {
    brandSlug: record.brand_slug,
    source: record.source,
    facebookPageId: record.facebook_page_id,
    facebookFormId: record.facebook_form_id,
    facebookCampaignId: record.facebook_campaign_id,
    facebookAdId: record.facebook_ad_id,
  };
}

export interface StartActivationInput {
  brandSlug: string;
  formId?: string;
  campaignId?: string;
  adId?: string;
  pageId?: string;
  source?: string;
}

export type StartActivationResult =
  | { ok: true; record: PortalActivationRecord }
  | { ok: false; error: "invalid_brand" };

/**
 * Creates a new activation, or reuses the caller's existing one (spec:
 * duplicate-browser-activation / refresh handling) when it's still live and
 * for the same brand.
 */
export async function startActivation(
  input: StartActivationInput,
  existingPublicId: string | null,
): Promise<StartActivationResult> {
  if (!isValidBrandSlug(input.brandSlug)) {
    return { ok: false, error: "invalid_brand" };
  }

  const store = getStore();

  if (existingPublicId) {
    const existing = await store.getActivationByPublicId(existingPublicId);
    if (existing && existing.brand_slug === input.brandSlug && new Date(existing.expires_at) > new Date()) {
      logActivation("activation_reused", { activationId: existing.id, status: existing.status });
      return { ok: true, record: existing };
    }
  }

  const expiresAt = new Date(Date.now() + getActivationTtlMinutes() * 60_000).toISOString();
  const record = await store.createActivation({
    public_activation_id: generateActivationPublicId(),
    brand_slug: input.brandSlug,
    source: input.source ?? "facebook_lead_ad",
    facebook_page_id: input.pageId ?? null,
    facebook_form_id: input.formId ?? null,
    facebook_campaign_id: input.campaignId ?? null,
    facebook_ad_id: input.adId ?? null,
    expires_at: expiresAt,
  });

  logActivation("activation_started", {
    activationId: record.id,
    brand: record.brand_slug,
    hasForm: Boolean(record.facebook_form_id),
  });
  return { ok: true, record };
}

/**
 * Finds/reuses the existing portal user for this brand and provisions a new
 * one only when none exists — never a duplicate (spec: portal provisioning).
 * Existing progress on a reused lead is left untouched.
 */
async function provisionPortalLead(
  externalLead: ExternalLeadRecord,
  brandSlug: string,
): Promise<LeadRecord> {
  const store = getStore();

  let lead = await store.getLeadByBrandAndHighLevelContact(brandSlug, externalLead.highlevel_contact_id);
  if (!lead && externalLead.normalized_email) {
    lead = await store.getLeadByBrandAndEmail(brandSlug, externalLead.normalized_email);
  }

  if (lead) {
    const needsPatch =
      !lead.highlevel_contact_id ||
      !lead.highlevel_location_id ||
      (externalLead.advisor_id && !lead.advisor_id);
    if (needsPatch) {
      lead = await store.updateLead(lead.id, {
        highlevel_contact_id: lead.highlevel_contact_id ?? externalLead.highlevel_contact_id,
        highlevel_location_id: lead.highlevel_location_id ?? externalLead.highlevel_location_id,
        advisor_id: lead.advisor_id ?? externalLead.advisor_id,
      });
    }
    logActivation("portal_lead_reused", { leadId: lead.id, brand: brandSlug });
    return lead;
  }

  const created = await store.createLead({
    portal_token: generatePortalToken(),
    first_name: externalLead.first_name ?? "Investor",
    last_name: externalLead.last_name ?? "",
    email: externalLead.normalized_email ?? "",
    phone: externalLead.normalized_phone,
    source: externalLead.source,
    campaign: externalLead.facebook_campaign_id,
    ad_set: null,
    ad: externalLead.facebook_ad_id,
    facebook_lead_id: null,
    initial_liquid_capital: null,
    initial_net_worth: null,
    initial_business_owner: null,
    brand_slug: brandSlug,
    highlevel_contact_id: externalLead.highlevel_contact_id,
    highlevel_location_id: externalLead.highlevel_location_id,
    advisor_id: externalLead.advisor_id,
  });
  logActivation("portal_lead_created", { leadId: created.id, brand: brandSlug });
  return created;
}

export function redirectUrlFor(brandSlug: string, lead: LeadRecord): string {
  const brandEntry = getBrandEntry(brandSlug);
  return brandEntry ? brandEntry.portalPath(lead.portal_token) : `/p/${lead.portal_token}`;
}

/** Attempts to claim `candidate`, retrying the whole match once if the claim loses a race. */
async function claimAndProvision(
  activation: PortalActivationRecord,
  candidate: ExternalLeadRecord,
  tier: string,
): Promise<PortalActivationRecord | null> {
  const store = getStore();
  const claimed = await store.claimExternalLead(candidate.id, activation.id);
  if (!claimed) return null; // lost the race — caller decides whether to retry

  const lead = await provisionPortalLead(claimed, activation.brand_slug);
  await store.linkExternalLeadToPortalLead(claimed.id, lead.id);
  const updated = await store.updateActivation(activation.id, {
    status: "ready",
    matched_external_lead_id: claimed.id,
    portal_lead_id: lead.id,
    last_match_tier: tier as PortalActivationRecord["last_match_tier"],
    last_candidate_count: 1,
  });
  logActivation("activation_matched", {
    activationId: activation.id,
    leadId: lead.id,
    tier,
  });
  return updated;
}

/**
 * One matching attempt for a pending activation. Called on every /status
 * poll. Mutates and returns the activation's current state — never guesses
 * between multiple plausible leads (spec: ambiguity detection).
 */
export async function pollActivation(activation: PortalActivationRecord): Promise<PortalActivationRecord> {
  const store = getStore();
  const now = new Date();

  if (activation.status === "expired") return activation;
  if (new Date(activation.expires_at) <= now) {
    logActivation("activation_expired", { activationId: activation.id });
    return store.updateActivation(activation.id, { status: "expired" });
  }
  if (activation.status === "ready" || activation.status === "fallback_required") {
    return activation;
  }

  if (!isTimeMatchingEnabled()) {
    logActivation("activation_fallback_required", {
      activationId: activation.id,
      reason: "time_matching_disabled",
    });
    return store.updateActivation(activation.id, {
      status: "fallback_required",
      last_failure_reason: "time_matching_disabled",
    });
  }

  const window = computeMatchWindow(
    new Date(activation.created_at),
    getAutoMatchBeforeSeconds(),
    getAutoMatchAfterSeconds(),
  );
  const criteria = criteriaFromActivation(activation);

  // Up to two attempts: a claim can legitimately lose a race to a concurrent
  // activation resolving the same lead — retry the match once, live.
  for (let attempt = 0; attempt < 2; attempt++) {
    const candidates = await store.findEligibleExternalLeads(
      activation.brand_slug,
      new Date(window.startMs).toISOString(),
      new Date(window.endMs).toISOString(),
    );
    const classification = classifyAutoMatch(candidates, criteria);

    if (classification.outcome === "matched") {
      const claimedActivation = await claimAndProvision(
        activation,
        classification.candidate,
        classification.tier,
      );
      if (claimedActivation) return claimedActivation;
      continue; // lost the race — loop retries with a fresh candidate set
    }

    if (classification.outcome === "ambiguous") {
      logActivation("activation_ambiguous", {
        activationId: activation.id,
        tier: classification.tier,
        candidateCount: classification.eligibleCount,
      });
      return store.updateActivation(activation.id, {
        status: "fallback_required",
        last_match_tier: classification.tier,
        last_candidate_count: classification.eligibleCount,
        last_failure_reason: "ambiguous",
      });
    }

    // no_match this attempt — nothing to retry against, stop looping.
    break;
  }

  const elapsedSeconds = (now.getTime() - new Date(activation.created_at).getTime()) / 1000;
  if (elapsedSeconds >= getActivationMaxWaitSeconds()) {
    logActivation("activation_fallback_required", {
      activationId: activation.id,
      reason: "no_match_within_window",
    });
    return store.updateActivation(activation.id, {
      status: "fallback_required",
      last_candidate_count: 0,
      last_failure_reason: "no_match_within_window",
    });
  }

  return activation;
}

export type LastFourResult =
  | { status: "ready"; redirectUrl: string }
  | { status: "fallback_required"; reason: "no_match" }
  | { status: "manual_resolution_required" }
  | { status: "expired" };

/**
 * Resolves a pending/fallback activation using the last four phone digits.
 * Never reveals how many leads matched (spec: no enumeration signal).
 */
export async function resolveLastFour(
  activation: PortalActivationRecord,
  phoneLastFour: string,
): Promise<LastFourResult> {
  const store = getStore();

  if (activation.status === "expired" || new Date(activation.expires_at) <= new Date()) {
    return { status: "expired" };
  }
  if (activation.status === "ready") {
    // Idempotent: a second submit while already resolved just no-ops the caller onward.
    const lead = activation.portal_lead_id ? await store.getLeadById(activation.portal_lead_id) : null;
    if (lead) return { status: "ready", redirectUrl: redirectUrlFor(activation.brand_slug, lead) };
  }

  if (activation.fallback_attempts >= getLastFourMaxAttempts()) {
    logActivation("last_four_attempts_exceeded", { activationId: activation.id });
    return { status: "manual_resolution_required" };
  }

  await store.updateActivation(activation.id, { fallback_attempts: activation.fallback_attempts + 1 });

  const window = computeMatchWindow(
    new Date(activation.created_at),
    getAutoMatchBeforeSeconds(),
    Math.max(getAutoMatchAfterSeconds(), 300), // broadened: the user has already waited past the auto-match window
  );
  const candidates = await store.findEligibleExternalLeads(
    activation.brand_slug,
    new Date(window.startMs).toISOString(),
    new Date().toISOString(),
  );
  const classification = classifyLastFourMatch(
    candidates,
    criteriaFromActivation(activation),
    phoneLastFour,
    window,
  );

  if (classification.outcome === "no_match") {
    logActivation("last_four_no_match", { activationId: activation.id });
    return { status: "fallback_required", reason: "no_match" };
  }
  if (classification.outcome === "ambiguous") {
    logActivation("last_four_ambiguous", { activationId: activation.id, count: classification.count });
    return { status: "manual_resolution_required" };
  }

  const claimedActivation = await claimAndProvision(activation, classification.candidate, "last_four");
  if (!claimedActivation) {
    // Extremely rare race loss on a user-submitted action — safe to ask them to retry.
    logActivation("last_four_claim_race_lost", { activationId: activation.id });
    return { status: "fallback_required", reason: "no_match" };
  }
  const lead = claimedActivation.portal_lead_id
    ? await store.getLeadById(claimedActivation.portal_lead_id)
    : null;
  if (!lead) return { status: "fallback_required", reason: "no_match" };
  return { status: "ready", redirectUrl: redirectUrlFor(activation.brand_slug, lead) };
}
