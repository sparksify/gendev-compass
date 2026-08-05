import type { LeadRecord, LeadStatus } from "@/types/lead";
import type { QuestionnaireRecord } from "@/types/questionnaire";
import type { VideoProgressRecord } from "@/types/portal";
import type { PortalEventRecord } from "@/types/analytics";
import type {
  AdvisorNoteRecord,
  AppointmentRecord,
  AppointmentStatus,
  FddRecordRow,
  QuestionnaireSubmissionWithAnswers,
  StaffRole,
  StaffSessionRecord,
  StaffUserRecord,
} from "@/types/advisor";

export interface CreateLeadRecordInput {
  portal_token: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  state?: string | null;
  source: string | null;
  campaign: string | null;
  ad_set: string | null;
  ad: string | null;
  facebook_lead_id: string | null;
  initial_liquid_capital: string | null;
  initial_net_worth: string | null;
  initial_business_owner: boolean | null;
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
    | "current_stage"
    | "assigned_advisor_id"
    | "last_activity_at"
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
    | "fdd_requested_at"
    | "fdd_acknowledged_at"
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
    | "play_count"
    | "first_played_at"
    | "last_event_at"
  >
>;

export interface InsertEventOptions {
  source?: string;
  staffUserId?: string | null;
  occurredAt?: string | null;
}

export interface CreateStaffUserInput {
  first_name: string;
  last_name: string;
  email: string;
  password_hash: string;
  role: StaffRole;
}

export type StaffUserPatch = Partial<
  Pick<StaffUserRecord, "first_name" | "last_name" | "password_hash" | "role" | "active" | "last_login_at">
>;

export interface CreateSubmissionInput {
  lead_id: string;
  questionnaire_version: string;
  submitted_at: string;
  answers: Array<{
    question_key: string;
    question_text: string;
    answer_value: string;
    answer_display_value: string;
  }>;
}

export interface CreateAppointmentInput {
  lead_id: string;
  advisor_id?: string | null;
  external_appointment_id?: string | null;
  scheduled_start?: string | null;
  scheduled_end?: string | null;
  time_zone?: string | null;
  status?: AppointmentStatus;
  booking_url?: string | null;
}

export type AppointmentPatch = Partial<
  Pick<
    AppointmentRecord,
    | "advisor_id"
    | "external_appointment_id"
    | "scheduled_start"
    | "scheduled_end"
    | "time_zone"
    | "status"
    | "booking_url"
  >
>;

export type FddRecordPatch = Partial<
  Pick<
    FddRecordRow,
    | "document_version"
    | "status"
    | "requested_at"
    | "sent_at"
    | "delivered_at"
    | "opened_at"
    | "acknowledged_at"
    | "acknowledgment_time_zone"
    | "provider_transaction_id"
    | "audit_certificate_url"
    | "destination_email"
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
    options?: InsertEventOptions,
  ): Promise<void>;

  /** Development helper: wipe progress so the demo flow can be replayed. */
  resetLeadProgress(leadId: string): Promise<void>;

  // -------------------------------------------------------------------------
  // Advisor backend. Pilot scale is one brand / one advisor, so list methods
  // return full tables and pages filter in application code — a deliberate
  // simplicity trade that keeps the Supabase and dev stores identical in
  // behavior. Revisit with SQL-side filtering when volume demands it.
  // -------------------------------------------------------------------------
  listLeads(): Promise<LeadRecord[]>;
  getLeadByEmail(email: string): Promise<LeadRecord | null>;
  listQuestionnaires(): Promise<QuestionnaireRecord[]>;
  listVideoProgress(): Promise<VideoProgressRecord[]>;

  createStaffUser(input: CreateStaffUserInput): Promise<StaffUserRecord>;
  getStaffUserById(id: string): Promise<StaffUserRecord | null>;
  getStaffUserByEmail(email: string): Promise<StaffUserRecord | null>;
  listStaffUsers(): Promise<StaffUserRecord[]>;
  updateStaffUser(id: string, patch: StaffUserPatch): Promise<StaffUserRecord>;

  createStaffSession(staffUserId: string, tokenHash: string, expiresAt: string): Promise<void>;
  getStaffSessionByHash(tokenHash: string): Promise<StaffSessionRecord | null>;
  deleteStaffSession(tokenHash: string): Promise<void>;

  createSubmission(input: CreateSubmissionInput): Promise<QuestionnaireSubmissionWithAnswers>;
  getSubmissionsForLead(leadId: string): Promise<QuestionnaireSubmissionWithAnswers[]>;

  createNote(leadId: string, staffUserId: string, note: string): Promise<AdvisorNoteRecord>;
  getNotesForLead(leadId: string): Promise<AdvisorNoteRecord[]>;

  createAppointment(input: CreateAppointmentInput): Promise<AppointmentRecord>;
  updateAppointment(id: string, patch: AppointmentPatch): Promise<AppointmentRecord>;
  getAppointmentsForLead(leadId: string): Promise<AppointmentRecord[]>;
  getAppointmentByExternalId(externalId: string): Promise<AppointmentRecord | null>;
  listAppointments(): Promise<AppointmentRecord[]>;

  getFddRecordForLead(leadId: string): Promise<FddRecordRow | null>;
  upsertFddRecord(leadId: string, patch: FddRecordPatch): Promise<FddRecordRow>;
  listFddRecords(): Promise<FddRecordRow[]>;

  getEventsForLead(leadId: string): Promise<PortalEventRecord[]>;
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
