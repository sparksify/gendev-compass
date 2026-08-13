import type { FddStatus } from "@/types/fdd";

export type LeadStatus =
  | "created"
  | "portal_opened"
  | "video_started"
  | "video_in_progress"
  | "video_completed"
  | "questionnaire_started"
  | "questionnaire_completed"
  | "qualified"
  | "review_required"
  | "calendar_viewed"
  | "booked";

export type QualificationResultValue = "qualified" | "review_required";

export interface LeadRecord {
  id: string;
  portal_token: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  state: string | null;
  source: string | null;
  campaign: string | null;
  ad_set: string | null;
  ad: string | null;
  facebook_lead_id: string | null;
  initial_liquid_capital: string | null;
  initial_net_worth: string | null;
  initial_business_owner: boolean | null;
  status: LeadStatus;
  /** Advisor pipeline stage (types/advisor.ts InvestorStage). */
  current_stage: string;
  assigned_advisor_id: string | null;
  last_activity_at: string | null;
  qualification_score: number | null;
  qualification_result: QualificationResultValue | null;
  qualification_reasons: string[] | null;
  created_at: string;
  updated_at: string;
  portal_first_opened_at: string | null;
  video_started_at: string | null;
  video_completed_at: string | null;
  questionnaire_started_at: string | null;
  questionnaire_completed_at: string | null;
  qualified_at: string | null;
  calendar_viewed_at: string | null;
  booked_at: string | null;
  appointment_id: string | null;
  appointment_start_at: string | null;
  fdd_status: FddStatus;
  fdd_requested_at: string | null;
  fdd_sent_at: string | null;
  fdd_delivered_at: string | null;
  fdd_received_at: string | null;
  fdd_eligible_at: string | null;
  fdd_provider_envelope_id: string | null;
  fdd_workflow_id: string | null;
  fdd_request_source: string | null;
  fdd_last_error: string | null;
  fdd_retry_count: number;
  /**
   * Platform domain links (nullable during the transition; repaired on
   * demand by ensureLeadDomainChain when missing).
   */
  organization_id: string | null;
  client_id: string | null;
  primary_opportunity_id: string | null;
  brand_id: string | null;

  // ---------------------------------------------------------------------
  // Attribution — first touch (see lib/tracking/attribution.ts). Written
  // once, at lead creation or the prospect's first portal visit, and never
  // overwritten afterward.
  // ---------------------------------------------------------------------
  first_utm_source: string | null;
  first_utm_medium: string | null;
  first_utm_campaign: string | null;
  first_utm_content: string | null;
  first_utm_term: string | null;
  first_fbclid: string | null;
  first_gclid: string | null;
  first_msclkid: string | null;
  first_fbp: string | null;
  first_fbc: string | null;
  first_referrer: string | null;
  first_landing_page: string | null;
  first_touch_at: string | null;

  // ---------------------------------------------------------------------
  // Attribution — latest touch. May update on later qualified visits (e.g.
  // an email-reminder click); the conversion event itself always retains
  // the first-touch values above for advertising reporting.
  // ---------------------------------------------------------------------
  last_utm_source: string | null;
  last_utm_medium: string | null;
  last_utm_campaign: string | null;
  last_utm_content: string | null;
  last_utm_term: string | null;
  last_fbclid: string | null;
  last_referrer: string | null;
  last_landing_page: string | null;
  last_touch_at: string | null;

  // ---------------------------------------------------------------------
  // Facebook Lead Ads — extended IDs. Populated via the lead creation API
  // (CRM automation today; a direct Lead Ads webhook is a future
  // extension point, see docs/tracking-attribution.md).
  // ---------------------------------------------------------------------
  facebook_campaign_id: string | null;
  facebook_adset_id: string | null;
  facebook_ad_id: string | null;
  facebook_form_id: string | null;
  facebook_page_id: string | null;

  // ---------------------------------------------------------------------
  // Advisor presentation/routing attribution (future multi-advisor
  // reporting — Darko/Glenn). Not sent to advertising platforms.
  // ---------------------------------------------------------------------
  advisor_presented: string | null;
  advisor_selected: string | null;
  advisor_booked: string | null;
  overflow_used: boolean;
}

export interface CreateLeadInput {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  state?: string;
  liquidCapital?: string;
  netWorth?: string;
  ownedBusinessBefore?: boolean;
  source?: string;
  campaign?: string;
  adSet?: string;
  ad?: string;
  facebookLeadId?: string;
}
