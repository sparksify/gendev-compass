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
