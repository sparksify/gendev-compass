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
  ClientPatch,
  ClientRecord,
  CreateActivityEventInput,
  CreateClientInput,
  CreateFddWorkflowInput,
  CreateIntegrationConnectionInput,
  CreateMembershipInput,
  CreateOpportunityAssignmentInput,
  CreateOpportunityInput,
  CreateOrganizationInput,
  CreateProfileInput,
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
  UpsertExternalMappingInput,
} from "@/types/domain";
import type {
  BrandStateEligibilityRecord,
  CensusImportJobPatch,
  CensusImportJobRecord,
  CreateCensusImportJobInput,
  FranchiseBrandRecord,
  RecordCensusRawImportInput,
  StateEligibilityStatus,
  TerritoryDefinitionRecord,
  TerritoryDefinitionType,
  TerritoryReviewRequestRecord,
  TerritorySearchRecord,
  TerritoryStatus,
  TerritoryZipCodeRecord,
  UpsertZipGeographyInput,
  ZipCodeReferenceRecord,
  UpsertZipCodeReferenceInput,
  ZipGeographyRecord,
} from "@/types/territory";

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
  /** Platform domain link (optional during the transition). */
  opportunity_id?: string | null;
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
    | "organization_id"
    | "client_id"
    | "opportunity_id"
    | "brand_id"
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
  /** Platform domain links (optional during the transition). */
  organization_id?: string | null;
  client_id?: string | null;
  opportunity_id?: string | null;
  brand_id?: string | null;
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
  /** Platform domain links (optional during the transition). */
  organization_id?: string | null;
  client_id?: string | null;
  opportunity_id?: string | null;
  advisor_profile_id?: string | null;
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

// ---------------------------------------------------------------------------
// Territory Advisor
// ---------------------------------------------------------------------------

export interface CreateFranchiseBrandInput {
  slug: string;
  name: string;
  active?: boolean;
  default_radius_miles?: number;
  /** Platform domain link (optional during the transition). */
  organization_id?: string | null;
}

export interface UpsertStateEligibilityInput {
  brand_id: string;
  state_code: string;
  status: StateEligibilityStatus;
  effective_date?: string | null;
  expiration_date?: string | null;
  notes_internal?: string | null;
}

export interface CreateTerritoryDefinitionInput {
  brand_id: string;
  territory_name: string;
  territory_code?: string | null;
  definition_type: TerritoryDefinitionType;
  status?: TerritoryStatus;
  center_latitude?: number | null;
  center_longitude?: number | null;
  radius_miles?: number | null;
  public_display_level?: "hidden" | "generalized" | "exact";
  internal_notes?: string | null;
  awarded_at?: string | null;
  reserved_until?: string | null;
}

export type TerritoryDefinitionPatch = Partial<
  Pick<
    TerritoryDefinitionRecord,
    | "territory_name"
    | "territory_code"
    | "definition_type"
    | "status"
    | "center_latitude"
    | "center_longitude"
    | "radius_miles"
    | "public_display_level"
    | "internal_notes"
    | "awarded_at"
    | "reserved_until"
  >
>;

export interface CreateTerritorySearchInput {
  lead_id: string;
  brand_id: string;
  raw_query: string;
  normalized_location?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  city?: string | null;
  state_code?: string | null;
  zip_code?: string | null;
  radius_miles?: number | null;
  result_status: TerritorySearchRecord["result_status"];
  result_summary?: Record<string, unknown> | null;
  /** Platform domain links (optional during the transition). */
  organization_id?: string | null;
  client_id?: string | null;
  opportunity_id?: string | null;
  matched_territory_count?: number;
  request_manual_review?: boolean;
}

export interface CreateTerritoryReviewRequestInput {
  lead_id: string;
  brand_id: string;
  territory_search_id?: string | null;
  prospect_message?: string | null;
  /** Platform domain links (optional during the transition). */
  organization_id?: string | null;
  client_id?: string | null;
  opportunity_id?: string | null;
}

export type TerritoryReviewRequestPatch = Partial<
  Pick<TerritoryReviewRequestRecord, "status" | "assigned_to" | "reviewed_at" | "internal_notes">
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

  createNote(
    leadId: string,
    staffUserId: string,
    note: string,
    links?: {
      organization_id?: string | null;
      client_id?: string | null;
      /** Null with client_id set = intentionally client-level note. */
      opportunity_id?: string | null;
      author_profile_id?: string | null;
    },
  ): Promise<AdvisorNoteRecord>;
  getNotesForLead(leadId: string): Promise<AdvisorNoteRecord[]>;

  createAppointment(input: CreateAppointmentInput): Promise<AppointmentRecord>;
  updateAppointment(id: string, patch: AppointmentPatch): Promise<AppointmentRecord>;
  getAppointmentsForLead(leadId: string): Promise<AppointmentRecord[]>;
  getAppointmentByExternalId(externalId: string): Promise<AppointmentRecord | null>;
  listAppointments(): Promise<AppointmentRecord[]>;

  getEventsForLead(leadId: string): Promise<PortalEventRecord[]>;

  // -------------------------------------------------------------------------
  // Platform domain (organizations / clients / opportunities). Brands are
  // the Territory Advisor's franchise_brands table (see below) — there is
  // deliberately no second brand entity. Additive: none of the legacy
  // methods above change shape. Route handlers should not call these
  // directly — go through lib/domain/* services.
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

  createFddWorkflow(input: CreateFddWorkflowInput): Promise<OpportunityFddWorkflowRecord>;
  getFddWorkflowByOpportunityId(opportunityId: string): Promise<OpportunityFddWorkflowRecord | null>;
  updateFddWorkflow(id: string, patch: FddWorkflowPatch): Promise<OpportunityFddWorkflowRecord>;
  listFddWorkflows(organizationId: string): Promise<OpportunityFddWorkflowRecord[]>;

  // -------------------------------------------------------------------------
  // Territory Advisor. Same simplicity trade as the advisor backend above:
  // list methods return full (brand-scoped, where applicable) sets and
  // callers filter/compute in application code — datasets stay small at
  // pilot scale and this keeps the Supabase and dev stores identical.
  // -------------------------------------------------------------------------
  getBrandBySlug(slug: string): Promise<FranchiseBrandRecord | null>;
  getBrandById(id: string): Promise<FranchiseBrandRecord | null>;
  listBrands(): Promise<FranchiseBrandRecord[]>;
  createBrand(input: CreateFranchiseBrandInput): Promise<FranchiseBrandRecord>;

  getStateEligibility(brandId: string, stateCode: string): Promise<BrandStateEligibilityRecord | null>;
  listStateEligibility(brandId: string): Promise<BrandStateEligibilityRecord[]>;
  upsertStateEligibility(input: UpsertStateEligibilityInput): Promise<BrandStateEligibilityRecord>;

  listTerritoryDefinitions(brandId: string): Promise<TerritoryDefinitionRecord[]>;
  getTerritoryDefinition(id: string): Promise<TerritoryDefinitionRecord | null>;
  createTerritoryDefinition(input: CreateTerritoryDefinitionInput): Promise<TerritoryDefinitionRecord>;
  updateTerritoryDefinition(id: string, patch: TerritoryDefinitionPatch): Promise<TerritoryDefinitionRecord>;

  listZipCodesForTerritory(territoryDefinitionId: string): Promise<TerritoryZipCodeRecord[]>;
  /** Bulk insert; silently skips zip codes already attached to this territory. */
  addTerritoryZipCodes(territoryDefinitionId: string, zipCodes: string[]): Promise<TerritoryZipCodeRecord[]>;
  removeTerritoryZipCode(id: string): Promise<void>;

  getZipCodeReference(zipCode: string): Promise<ZipCodeReferenceRecord | null>;
  listZipCodeReferences(): Promise<ZipCodeReferenceRecord[]>;
  upsertZipCodeReferences(rows: UpsertZipCodeReferenceInput[]): Promise<void>;

  createTerritorySearch(input: CreateTerritorySearchInput): Promise<TerritorySearchRecord>;
  getTerritorySearch(id: string): Promise<TerritorySearchRecord | null>;
  listTerritorySearchesForLead(leadId: string): Promise<TerritorySearchRecord[]>;
  listTerritorySearches(): Promise<TerritorySearchRecord[]>;

  createTerritoryReviewRequest(input: CreateTerritoryReviewRequestInput): Promise<TerritoryReviewRequestRecord>;
  getTerritoryReviewRequest(id: string): Promise<TerritoryReviewRequestRecord | null>;
  listTerritoryReviewRequestsForLead(leadId: string): Promise<TerritoryReviewRequestRecord[]>;
  listTerritoryReviewRequests(): Promise<TerritoryReviewRequestRecord[]>;
  updateTerritoryReviewRequest(
    id: string,
    patch: TerritoryReviewRequestPatch,
  ): Promise<TerritoryReviewRequestRecord>;

  /**
   * ZIP boundary layer (zip_code_geographies.geojson). Bulk rows come from
   * the polygon import pipeline; readers fetch display-grade GeoJSON for a
   * specific set of ZIPs. In environments without the PostGIS table (local
   * SQL harness) the Supabase implementation surfaces the database error;
   * the dev store emulates the table in-process.
   */
  upsertZipGeographies(rows: UpsertZipGeographyInput[]): Promise<void>;
  listZipGeographies(zipCodes: string[]): Promise<ZipGeographyRecord[]>;
  /** True once at least one boundary shape has been loaded for the state — used by the polygon backfill cron to pick the next uncovered state. */
  hasZipGeographiesForState(stateCode: string): Promise<boolean>;

  /**
   * Backend job tracking for the Census ACS import (lib/geocoding/censusJob.ts)
   * — the server-side worker's source of truth, independent of any browser
   * tab. See types/territory.ts for the full architecture note.
   */
  createCensusImportJob(input: CreateCensusImportJobInput): Promise<CensusImportJobRecord>;
  updateCensusImportJob(id: string, patch: CensusImportJobPatch): Promise<CensusImportJobRecord>;
  getCensusImportJob(id: string): Promise<CensusImportJobRecord | null>;
  /** Most recent job with status 'running', or null if nothing is in flight. */
  getActiveCensusImportJob(): Promise<CensusImportJobRecord | null>;
  /** Most recent jobs first — used to derive "last successful"/"last failed" for the admin health view. */
  listCensusImportJobs(limit: number): Promise<CensusImportJobRecord[]>;
  /** Upserts the raw ACS capture for one (vintage, state) — see CensusAcsRawRecord. */
  recordCensusRawImport(input: RecordCensusRawImportInput): Promise<void>;
  /** Total distinct (vintage, state) raw captures on file — used by the admin health view. */
  countCensusAcsRaw(): Promise<number>;
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
