import type { ActivationCriteria, ExternalLeadRecord, MatchTier } from "@/types/portalActivation";

/**
 * Pure, store-agnostic matching logic for the activation flow. Kept free of
 * I/O so the ambiguity/tiering rules can be unit tested directly against
 * plain arrays (see matching.test.ts).
 *
 * Rule of the whole module: never guess. A tier either resolves to exactly
 * one eligible candidate or it doesn't — multiple candidates at the most
 * specific tier that found any results is ambiguity, not a tie to break.
 */

export interface MatchWindow {
  /** Inclusive lower bound for received_at, in epoch ms. */
  startMs: number;
  /** Inclusive upper bound for received_at, in epoch ms. */
  endMs: number;
}

export type AutoMatchOutcome =
  | { outcome: "matched"; tier: MatchTier; candidate: ExternalLeadRecord; eligibleCount: number }
  | { outcome: "ambiguous"; tier: MatchTier; candidates: ExternalLeadRecord[]; eligibleCount: number }
  | { outcome: "no_match"; eligibleCount: 0 };

export type LastFourOutcome =
  | { outcome: "matched"; candidate: ExternalLeadRecord }
  | { outcome: "ambiguous"; count: number }
  | { outcome: "no_match" };

/** The window a lead's `received_at` must fall inside to be considered for a given activation. */
export function computeMatchWindow(
  activationCreatedAt: Date,
  beforeSeconds: number,
  afterSeconds: number,
): MatchWindow {
  const createdMs = activationCreatedAt.getTime();
  return {
    startMs: createdMs - beforeSeconds * 1000,
    endMs: createdMs + afterSeconds * 1000,
  };
}

function withinWindow(receivedAtIso: string, window: MatchWindow): boolean {
  const receivedMs = new Date(receivedAtIso).getTime();
  return receivedMs >= window.startMs && receivedMs <= window.endMs;
}

/** Unclaimed, right brand, inside the arrival window. The base eligible set every tier narrows. */
export function selectEligibleCandidates(
  leads: ExternalLeadRecord[],
  criteria: ActivationCriteria,
  window: MatchWindow,
): ExternalLeadRecord[] {
  return leads.filter(
    (lead) =>
      lead.claimed_at === null &&
      lead.brand_slug === criteria.brandSlug &&
      withinWindow(lead.received_at, window),
  );
}

function tierFormContext(
  eligible: ExternalLeadRecord[],
  criteria: ActivationCriteria,
): ExternalLeadRecord[] | null {
  const hasContext = Boolean(
    criteria.facebookCampaignId || criteria.facebookAdId || criteria.facebookPageId,
  );
  if (!criteria.facebookFormId || !hasContext) return null;
  return eligible.filter(
    (lead) =>
      lead.facebook_form_id === criteria.facebookFormId &&
      ((criteria.facebookCampaignId && lead.facebook_campaign_id === criteria.facebookCampaignId) ||
        (criteria.facebookAdId && lead.facebook_ad_id === criteria.facebookAdId) ||
        (criteria.facebookPageId && lead.facebook_page_id === criteria.facebookPageId)),
  );
}

function tierFormOnly(
  eligible: ExternalLeadRecord[],
  criteria: ActivationCriteria,
): ExternalLeadRecord[] | null {
  if (!criteria.facebookFormId) return null;
  return eligible.filter((lead) => lead.facebook_form_id === criteria.facebookFormId);
}

function tierBrandSourceTime(
  eligible: ExternalLeadRecord[],
  criteria: ActivationCriteria,
): ExternalLeadRecord[] {
  // Already brand + window filtered by selectEligibleCandidates; narrow by source when we have one.
  if (!criteria.source) return eligible;
  return eligible.filter((lead) => lead.source === criteria.source);
}

/**
 * Cascades from most specific to least specific tier, stopping at the first
 * tier that produces any candidates. A tier that produces more than one
 * candidate is ambiguous and we do not fall through to a broader tier —
 * broader tiers only add more candidates, never resolve ambiguity.
 */
export function classifyAutoMatch(
  eligible: ExternalLeadRecord[],
  criteria: ActivationCriteria,
): AutoMatchOutcome {
  const tiers: Array<{ tier: MatchTier; candidates: ExternalLeadRecord[] | null }> = [
    { tier: "form_context", candidates: tierFormContext(eligible, criteria) },
    { tier: "form_only", candidates: tierFormOnly(eligible, criteria) },
    { tier: "brand_source_time", candidates: tierBrandSourceTime(eligible, criteria) },
  ];

  for (const { tier, candidates } of tiers) {
    if (candidates === null) continue; // tier not applicable (missing context)
    if (candidates.length === 0) continue; // try a broader tier
    if (candidates.length === 1) {
      return { outcome: "matched", tier, candidate: candidates[0], eligibleCount: 1 };
    }
    return { outcome: "ambiguous", tier, candidates, eligibleCount: candidates.length };
  }

  return { outcome: "no_match", eligibleCount: 0 };
}

/**
 * Last-four fallback: same brand + unclaimed + broadened window (now
 * uncapped on the upper bound — the user has already waited past the
 * automatic-match window by the time they submit this), narrowed by the
 * submitted last-four digits and, when available, the form context.
 */
export function classifyLastFourMatch(
  leads: ExternalLeadRecord[],
  criteria: ActivationCriteria,
  phoneLastFour: string,
  window: MatchWindow,
): LastFourOutcome {
  const eligible = selectEligibleCandidates(leads, criteria, window).filter(
    (lead) => lead.phone_last_four === phoneLastFour,
  );

  const narrowed = criteria.facebookFormId
    ? eligible.filter((lead) => lead.facebook_form_id === criteria.facebookFormId)
    : eligible;
  const candidates = narrowed.length > 0 ? narrowed : eligible;

  if (candidates.length === 0) return { outcome: "no_match" };
  if (candidates.length === 1) return { outcome: "matched", candidate: candidates[0] };
  return { outcome: "ambiguous", count: candidates.length };
}
