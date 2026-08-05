import type { LeadRecord, LeadStatus } from "@/types/lead";
import type { QuestionnaireRecord } from "@/types/questionnaire";
import type { VideoProgressRecord } from "@/types/portal";
import type { FddAuditInsert, FddAuditRecord, FddStatus } from "@/types/fdd";
import type {
  ActivationPatch,
  CreateActivationInput,
  CreateExternalLeadInput,
  ExternalLeadRecord,
  PortalActivationRecord,
} from "@/types/portalActivation";

export interface CreateLeadRecordInput {
  portal_token: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  source: string | null;
  campaign: string | null;
  ad_set: string | null;
  ad: string | null;
  facebook_lead_id: string | null;
  initial_liquid_capital: string | null;
  initial_net_worth: string | null;
  initial_business_owner: boolean | null;
  brand_slug?: string;
  highlevel_contact_id?: string | null;
  highlevel_location_id?: string | null;
  advisor_id?: string | null;
}

export interface CreateQuestionnaireInput {
  lead_id: string;
  investment_timeline: string;
  liquid_capital: string;
  net_worth: string;
  business_ownership: string;
  primary_interest: string;
  remaining_questions: string;
  decision_criteria: string;
  decision_participants: string;
  accuracy_confirmed: boolean;
}

export type LeadPatch = Partial<
  Pick<
    LeadRecord,
    | "status"
    | "qualification_score"
    | "qualification_result"
    | "qualification_reasons"
    | "portal_first_opened_at"
    | "video_started_at"
    | "video_completed_at"
    | "questionnaire_started_at"
    | "questionnaire_completed_at"
    | "qualified_at"
    | "calendar_viewed_at"
    | "booked_at"
    | "appointment_id"
    | "appointment_start_at"
    | "fdd_status"
    | "fdd_requested_at"
    | "fdd_sent_at"
    | "fdd_delivered_at"
    | "fdd_received_at"
    | "fdd_eligible_at"
    | "fdd_provider_envelope_id"
    | "fdd_workflow_id"
    | "fdd_request_source"
    | "fdd_last_error"
    | "fdd_retry_count"
    | "highlevel_contact_id"
    | "highlevel_location_id"
    | "advisor_id"
  >
>;

export type VideoProgressPatch = Partial<
  Pick<
    VideoProgressRecord,
    | "wistia_media_id"
    | "highest_percent_watched"
    | "accumulated_seconds_watched"
    | "last_playhead_position"
    | "started"
    | "completed"
    | "last_event_at"
  >
>;

export interface PortalStore {
  createLead(input: CreateLeadRecordInput): Promise<LeadRecord>;
  getLeadByToken(token: string): Promise<LeadRecord | null>;
  getLeadById(id: string): Promise<LeadRecord | null>;
  updateLead(id: string, patch: LeadPatch): Promise<LeadRecord>;

  getVideoProgress(leadId: string): Promise<VideoProgressRecord | null>;
  upsertVideoProgress(leadId: string, patch: VideoProgressPatch): Promise<VideoProgressRecord>;

  getQuestionnaire(leadId: string): Promise<QuestionnaireRecord | null>;
  createQuestionnaire(input: CreateQuestionnaireInput): Promise<QuestionnaireRecord>;

  insertEvent(
    leadId: string,
    eventName: string,
    eventData: Record<string, unknown> | null,
    pageUrl: string | null,
  ): Promise<void>;

  /** Resolves the lead a document-provider envelope belongs to. */
  getLeadByFddEnvelopeId(envelopeId: string): Promise<LeadRecord | null>;
  /** Leads that have started the FDD workflow, newest request first (admin view). */
  listFddLeads(): Promise<LeadRecord[]>;

  insertFddAudit(entry: FddAuditInsert): Promise<void>;
  listFddAudit(leadId: string): Promise<FddAuditRecord[]>;
  /** Replay guard: whether an external webhook event was already processed. */
  hasFddAuditEvent(externalEventId: string): Promise<boolean>;

  /** Development helper: wipe progress so the demo flow can be replayed. */
  resetLeadProgress(leadId: string): Promise<void>;

  // -- Facebook lead → activation flow -------------------------------------

  /** Locate the existing portal user for this brand + HighLevel contact, if any. */
  getLeadByBrandAndHighLevelContact(brandSlug: string, contactId: string): Promise<LeadRecord | null>;
  /** Secondary reuse check (no HighLevel contact match) so repeat submissions don't duplicate a portal user. */
  getLeadByBrandAndEmail(brandSlug: string, normalizedEmail: string): Promise<LeadRecord | null>;

  /**
   * Idempotent upsert keyed on (highlevel_contact_id, highlevel_location_id).
   * A duplicate webhook delivery updates attribution fields only — it never
   * resets claimed_at/claimed_by_activation_id on an already-claimed lead.
   */
  upsertExternalLead(
    input: CreateExternalLeadInput,
  ): Promise<{ record: ExternalLeadRecord; duplicate: boolean }>;
  getExternalLeadById(id: string): Promise<ExternalLeadRecord | null>;
  /** Unclaimed leads for a brand with received_at inside [startIso, endIso]. */
  findEligibleExternalLeads(
    brandSlug: string,
    startIso: string,
    endIso: string,
  ): Promise<ExternalLeadRecord[]>;
  /**
   * Atomic conditional claim: succeeds only if the row is still unclaimed.
   * Returns null when the claim loses a race (caller should retry matching).
   */
  claimExternalLead(externalLeadId: string, activationId: string): Promise<ExternalLeadRecord | null>;
  linkExternalLeadToPortalLead(externalLeadId: string, leadId: string): Promise<void>;

  createActivation(input: CreateActivationInput): Promise<PortalActivationRecord>;
  getActivationByPublicId(publicId: string): Promise<PortalActivationRecord | null>;
  updateActivation(id: string, patch: ActivationPatch): Promise<PortalActivationRecord>;

  /** Admin/debug view (spec: structured diagnostics), newest first. */
  listRecentActivations(limit: number): Promise<PortalActivationRecord[]>;
  listRecentExternalLeads(limit: number): Promise<ExternalLeadRecord[]>;
}

/** Forward-only ordering used to avoid regressing a lead's status. */
export const STATUS_ORDER: LeadStatus[] = [
  "created",
  "portal_opened",
  "video_started",
  "video_in_progress",
  "video_completed",
  "questionnaire_started",
  "questionnaire_completed",
  "qualified",
  "review_required",
  "calendar_viewed",
  "booked",
];

export function statusRank(status: LeadStatus): number {
  const index = STATUS_ORDER.indexOf(status);
  return index === -1 ? 0 : index;
}

/**
 * Forward-only ordering for the FDD workflow so late or replayed webhooks
 * never regress the status. `error_manual_review` sits outside this ordering —
 * it is entered and cleared explicitly, never by rank comparison.
 */
export const FDD_STATUS_ORDER: FddStatus[] = [
  "not_requested",
  "request_processing",
  "fdd_sent",
  "fdd_delivered",
  "fdd_received",
  "waiting_period_active",
  "eligible_for_agreement",
];

export function fddStatusRank(status: FddStatus): number {
  const index = FDD_STATUS_ORDER.indexOf(status);
  return index === -1 ? 0 : index;
}
