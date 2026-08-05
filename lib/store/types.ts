import type { LeadRecord, LeadStatus } from "@/types/lead";
import type { QuestionnaireRecord } from "@/types/questionnaire";
import type { VideoProgressRecord } from "@/types/portal";
import type { PortalEventRecord } from "@/types/analytics";
import type { FddAuditInsert, FddAuditRecord, FddStatus } from "@/types/fdd";
import type {
  AdvisorNoteRecord,
  AppointmentRecord,
  AppointmentStatus,
  QuestionnaireSubmissionWithAnswers,
  StaffRole,
  StaffSessionRecord,
  StaffUserRecord,
} from "@/types/advisor";
import type {
  ActivityEventRecord,
  BrandPatch,
  BrandRecord,
  ClientPatch,
  ClientRecord,
  CreateActivityEventInput,
  CreateBrandInput,
  CreateClientInput,
  CreateFddWorkflowInput,
  CreateIntegrationConnectionInput,
  CreateMembershipInput,
  CreateOpportunityAssignmentInput,
  CreateOpportunityInput,
  CreateOrganizationInput,
  CreateProfileInput,
  CreateTerritoryRequestInput,
  ExternalEntityType,
  ExternalProvider,
  ExternalRecordMappingRecord,
  FddWorkflowPatch,
  IntegrationConnectionRecord,
  OpportunityAssignmentRecord,
  OpportunityFddWorkflowRecord,
  OpportunityPatch,
  OpportunityRecord,
  OrganizationMembershipRecord,
  OrganizationRecord,
  ProfileRecord,
  TerritoryRequestPatch,
  TerritoryRequestRecord,
  UpsertExternalMappingInput,
} from "@/types/domain";

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
    | "organization_id"
    | "client_id"
    | "primary_opportunity_id"
    | "brand_id"
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

  getEventsForLead(leadId: string): Promise<PortalEventRecord[]>;

  // -------------------------------------------------------------------------
  // Platform domain (organizations / clients / brands / opportunities).
  // Additive: none of the legacy methods above change shape. Route handlers
  // should not call these directly — go through lib/domain/* services.
  // -------------------------------------------------------------------------
  createOrganization(input: CreateOrganizationInput): Promise<OrganizationRecord>;
  getOrganizationById(id: string): Promise<OrganizationRecord | null>;
  getOrganizationBySlug(slug: string): Promise<OrganizationRecord | null>;

  createProfile(input: CreateProfileInput): Promise<ProfileRecord>;
  getProfileById(id: string): Promise<ProfileRecord | null>;
  getProfileByLegacyStaffUserId(staffUserId: string): Promise<ProfileRecord | null>;
  getProfileByEmail(email: string): Promise<ProfileRecord | null>;
  listProfiles(): Promise<ProfileRecord[]>;

  createMembership(input: CreateMembershipInput): Promise<OrganizationMembershipRecord>;
  getMembership(organizationId: string, profileId: string): Promise<OrganizationMembershipRecord | null>;
  listMembershipsForProfile(profileId: string): Promise<OrganizationMembershipRecord[]>;
  listMembershipsForOrganization(organizationId: string): Promise<OrganizationMembershipRecord[]>;

  createClient(input: CreateClientInput): Promise<ClientRecord>;
  getClientById(id: string): Promise<ClientRecord | null>;
  getClientBySourceLeadId(leadId: string): Promise<ClientRecord | null>;
  updateClient(id: string, patch: ClientPatch): Promise<ClientRecord>;
  listClients(organizationId: string): Promise<ClientRecord[]>;
  /** Duplicate *candidates* by case-insensitive email — never auto-merged. */
  findClientsByEmail(organizationId: string, email: string): Promise<ClientRecord[]>;

  createBrand(input: CreateBrandInput): Promise<BrandRecord>;
  getBrandById(id: string): Promise<BrandRecord | null>;
  getBrandBySlug(organizationId: string, slug: string): Promise<BrandRecord | null>;
  updateBrand(id: string, patch: BrandPatch): Promise<BrandRecord>;
  listBrands(organizationId: string): Promise<BrandRecord[]>;

  createOpportunity(input: CreateOpportunityInput): Promise<OpportunityRecord>;
  getOpportunityById(id: string): Promise<OpportunityRecord | null>;
  getOpportunityBySourceLeadId(leadId: string): Promise<OpportunityRecord | null>;
  updateOpportunity(id: string, patch: OpportunityPatch): Promise<OpportunityRecord>;
  listOpportunitiesForClient(clientId: string): Promise<OpportunityRecord[]>;
  listOpportunities(organizationId: string): Promise<OpportunityRecord[]>;

  createOpportunityAssignment(
    input: CreateOpportunityAssignmentInput,
  ): Promise<OpportunityAssignmentRecord>;
  listAssignmentsForOpportunity(opportunityId: string): Promise<OpportunityAssignmentRecord[]>;

  upsertExternalMapping(input: UpsertExternalMappingInput): Promise<ExternalRecordMappingRecord>;
  getExternalMapping(
    organizationId: string,
    provider: ExternalProvider,
    entityType: ExternalEntityType,
    externalId: string,
  ): Promise<ExternalRecordMappingRecord | null>;
  listMappingsForEntity(internalEntityId: string): Promise<ExternalRecordMappingRecord[]>;

  createIntegrationConnection(
    input: CreateIntegrationConnectionInput,
  ): Promise<IntegrationConnectionRecord>;
  listIntegrationConnections(organizationId: string): Promise<IntegrationConnectionRecord[]>;

  insertActivityEvent(input: CreateActivityEventInput): Promise<ActivityEventRecord | null>;
  listActivityForOpportunity(opportunityId: string): Promise<ActivityEventRecord[]>;
  listActivityForClient(clientId: string): Promise<ActivityEventRecord[]>;
  hasActivityExternalEvent(
    organizationId: string,
    eventSource: string,
    externalEventId: string,
  ): Promise<boolean>;

  createTerritoryRequest(input: CreateTerritoryRequestInput): Promise<TerritoryRequestRecord>;
  getTerritoryRequestById(id: string): Promise<TerritoryRequestRecord | null>;
  listTerritoryRequestsForOpportunity(opportunityId: string): Promise<TerritoryRequestRecord[]>;
  updateTerritoryRequest(id: string, patch: TerritoryRequestPatch): Promise<TerritoryRequestRecord>;

  createFddWorkflow(input: CreateFddWorkflowInput): Promise<OpportunityFddWorkflowRecord>;
  getFddWorkflowByOpportunityId(opportunityId: string): Promise<OpportunityFddWorkflowRecord | null>;
  updateFddWorkflow(id: string, patch: FddWorkflowPatch): Promise<OpportunityFddWorkflowRecord>;
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
