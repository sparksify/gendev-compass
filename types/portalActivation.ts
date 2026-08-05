/**
 * Facebook lead → private portal activation flow types.
 *
 * `ExternalLeadRecord` is intake staging for a Facebook lead delivered by
 * HighLevel, before it is matched and claimed. `PortalActivationRecord` is
 * one browser's activation attempt (correlated via an opaque cookie, never
 * the URL). Claiming an external lead provisions/reuses a row in the
 * existing `leads` table — that table is already this app's "portal user +
 * opportunity" record; no separate account or opportunity table is added.
 */

export type PortalActivationStatus = "pending" | "matched" | "fallback_required" | "ready" | "expired";

/** Cascading match specificity, most confident first. Recorded for diagnostics only. */
export type MatchTier = "form_context" | "form_only" | "brand_source_time" | "last_four";

export interface ExternalLeadRecord {
  id: string;
  highlevel_contact_id: string;
  highlevel_location_id: string;
  brand_slug: string;
  advisor_id: string | null;
  first_name: string | null;
  last_name: string | null;
  normalized_email: string | null;
  normalized_phone: string | null;
  phone_last_four: string | null;
  source: string | null;
  facebook_page_id: string | null;
  facebook_form_id: string | null;
  facebook_campaign_id: string | null;
  facebook_ad_id: string | null;
  submitted_at: string | null;
  received_at: string;
  claimed_at: string | null;
  claimed_by_activation_id: string | null;
  matched_lead_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateExternalLeadInput {
  highlevel_contact_id: string;
  highlevel_location_id: string;
  brand_slug: string;
  advisor_id: string | null;
  first_name: string | null;
  last_name: string | null;
  normalized_email: string | null;
  normalized_phone: string | null;
  phone_last_four: string | null;
  source: string | null;
  facebook_page_id: string | null;
  facebook_form_id: string | null;
  facebook_campaign_id: string | null;
  facebook_ad_id: string | null;
  submitted_at: string | null;
  received_at: string;
}

export interface PortalActivationRecord {
  id: string;
  public_activation_id: string;
  brand_slug: string;
  source: string | null;
  facebook_page_id: string | null;
  facebook_form_id: string | null;
  facebook_campaign_id: string | null;
  facebook_ad_id: string | null;
  status: PortalActivationStatus;
  matched_external_lead_id: string | null;
  portal_lead_id: string | null;
  fallback_attempts: number;
  last_match_tier: MatchTier | null;
  last_candidate_count: number | null;
  last_failure_reason: string | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export interface CreateActivationInput {
  public_activation_id: string;
  brand_slug: string;
  source: string | null;
  facebook_page_id: string | null;
  facebook_form_id: string | null;
  facebook_campaign_id: string | null;
  facebook_ad_id: string | null;
  expires_at: string;
}

export type ActivationPatch = Partial<
  Pick<
    PortalActivationRecord,
    | "status"
    | "matched_external_lead_id"
    | "portal_lead_id"
    | "fallback_attempts"
    | "last_match_tier"
    | "last_candidate_count"
    | "last_failure_reason"
  >
>;

/** The activation-context attribution a browser arrives with (from /activate query params). */
export interface ActivationCriteria {
  brandSlug: string;
  source: string | null;
  facebookPageId: string | null;
  facebookFormId: string | null;
  facebookCampaignId: string | null;
  facebookAdId: string | null;
}
