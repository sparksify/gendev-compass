import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { LeadRecord } from "@/types/lead";
import type { QuestionnaireRecord } from "@/types/questionnaire";
import type { VideoProgressRecord } from "@/types/portal";
import type { PortalEventRecord } from "@/types/analytics";
import type { FddAuditInsert, FddAuditRecord } from "@/types/fdd";
import type {
  AdvisorNoteRecord,
  AppointmentRecord,
  QuestionnaireAnswerRecord,
  QuestionnaireSubmissionRecord,
  QuestionnaireSubmissionWithAnswers,
  StaffSessionRecord,
  StaffUserRecord,
} from "@/types/advisor";
import type {
  AppointmentPatch,
  CreateAppointmentInput,
  CreateFranchiseBrandInput,
  CreateLeadRecordInput,
  CreateQuestionnaireInput,
  CreateStaffUserInput,
  CreateSubmissionInput,
  CreateTerritoryDefinitionInput,
  CreateTerritoryReviewRequestInput,
  CreateTerritorySearchInput,
  InsertEventOptions,
  LeadPatch,
  PortalStore,
  StaffUserPatch,
  TerritoryDefinitionPatch,
  TerritoryReviewRequestPatch,
  UpsertStateEligibilityInput,
  VideoProgressPatch,
} from "./types";
import type {
  BrandStateEligibilityRecord,
  CensusImportJobPatch,
  CensusImportJobRecord,
  CreateCensusImportJobInput,
  FranchiseBrandRecord,
  RecordCensusRawImportInput,
  TerritoryDefinitionRecord,
  TerritoryReviewRequestRecord,
  TerritorySearchRecord,
  TerritoryZipCodeRecord,
  ZipCodeReferenceRecord,
  UpsertZipCodeReferenceInput,
  ZipGeographyRecord,
} from "@/types/territory";
import type { NotificationDeliveryRecord } from "@/types/notifications";
import type {
  ActivityEventRecord,
  ClientRecord,
  ExternalRecordMappingRecord,
  IntegrationConnectionRecord,
  OpportunityAssignmentRecord,
  OpportunityFddWorkflowRecord,
  OpportunityRecord,
  OrganizationMembershipRecord,
  OrganizationRecord,
  ProfileRecord,
} from "@/types/domain";

function nowIso(): string {
  return new Date().toISOString();
}

export function createSupabaseStore(): PortalStore {
  const db = getSupabaseAdmin();

  return {
    async createLead(input: CreateLeadRecordInput): Promise<LeadRecord> {
      const { data, error } = await db
        .from("leads")
        .insert({ ...input, status: "created" })
        .select()
        .single();
      if (error) throw new Error(`Failed to create lead: ${error.message}`);
      return data as LeadRecord;
    },

    async getLeadByToken(token: string): Promise<LeadRecord | null> {
      const { data, error } = await db
        .from("leads")
        .select()
        .eq("portal_token", token)
        .maybeSingle();
      if (error) throw new Error(`Failed to load lead: ${error.message}`);
      return (data as LeadRecord | null) ?? null;
    },

    async getLeadById(id: string): Promise<LeadRecord | null> {
      const { data, error } = await db.from("leads").select().eq("id", id).maybeSingle();
      if (error) throw new Error(`Failed to load lead: ${error.message}`);
      return (data as LeadRecord | null) ?? null;
    },

    async updateLead(id: string, patch: LeadPatch): Promise<LeadRecord> {
      const { data, error } = await db
        .from("leads")
        .update({ ...patch, updated_at: nowIso() })
        .eq("id", id)
        .select()
        .single();
      if (error) throw new Error(`Failed to update lead: ${error.message}`);
      return data as LeadRecord;
    },

    async getVideoProgress(leadId: string): Promise<VideoProgressRecord | null> {
      const { data, error } = await db
        .from("video_progress")
        .select()
        .eq("lead_id", leadId)
        .maybeSingle();
      if (error) throw new Error(`Failed to load video progress: ${error.message}`);
      return (data as VideoProgressRecord | null) ?? null;
    },

    async upsertVideoProgress(leadId: string, patch: VideoProgressPatch): Promise<VideoProgressRecord> {
      const existing = await this.getVideoProgress(leadId);
      if (existing) {
        const { data, error } = await db
          .from("video_progress")
          .update({ ...patch, updated_at: nowIso() })
          .eq("lead_id", leadId)
          .select()
          .single();
        if (error) throw new Error(`Failed to update video progress: ${error.message}`);
        return data as VideoProgressRecord;
      }
      const { data, error } = await db
        .from("video_progress")
        .insert({
          lead_id: leadId,
          highest_percent_watched: 0,
          accumulated_seconds_watched: 0,
          last_playhead_position: 0,
          started: false,
          completed: false,
          ...patch,
        })
        .select()
        .single();
      if (error) throw new Error(`Failed to create video progress: ${error.message}`);
      return data as VideoProgressRecord;
    },

    async getQuestionnaire(leadId: string): Promise<QuestionnaireRecord | null> {
      const { data, error } = await db
        .from("questionnaire_responses")
        .select()
        .eq("lead_id", leadId)
        .maybeSingle();
      if (error) throw new Error(`Failed to load questionnaire: ${error.message}`);
      return (data as QuestionnaireRecord | null) ?? null;
    },

    async createQuestionnaire(input: CreateQuestionnaireInput): Promise<QuestionnaireRecord> {
      const { data, error } = await db
        .from("questionnaire_responses")
        .insert(input)
        .select()
        .single();
      if (error) throw new Error(`Failed to save questionnaire: ${error.message}`);
      return data as QuestionnaireRecord;
    },

    async insertEvent(leadId, eventName, eventData, pageUrl, options?: InsertEventOptions): Promise<void> {
      const { error } = await db.from("portal_events").insert({
        lead_id: leadId,
        event_name: eventName,
        event_data: eventData,
        page_url: pageUrl,
        event_source: options?.source ?? "portal",
        created_by_staff_user_id: options?.staffUserId ?? null,
        occurred_at: options?.occurredAt ?? null,
      });
      if (error) {
        // Event logging must never break the user flow.
        console.error(`Failed to insert portal event ${eventName}: ${error.message}`);
      }
    },

    async getLeadByFddEnvelopeId(envelopeId: string): Promise<LeadRecord | null> {
      const { data, error } = await db
        .from("leads")
        .select()
        .eq("fdd_provider_envelope_id", envelopeId)
        .maybeSingle();
      if (error) throw new Error(`Failed to look up envelope: ${error.message}`);
      return (data as LeadRecord | null) ?? null;
    },

    async listFddLeads(): Promise<LeadRecord[]> {
      const { data, error } = await db
        .from("leads")
        .select()
        .neq("fdd_status", "not_requested")
        .order("fdd_requested_at", { ascending: false });
      if (error) throw new Error(`Failed to list FDD leads: ${error.message}`);
      return (data as LeadRecord[]) ?? [];
    },

    async insertFddAudit(entry: FddAuditInsert): Promise<void> {
      const { error } = await db.from("fdd_audit_log").insert({
        lead_id: entry.lead_id,
        event: entry.event,
        source: entry.source,
        actor: entry.actor,
        external_event_id: entry.external_event_id ?? null,
        ip_address: entry.ip_address ?? null,
        before_values: entry.before_values ?? null,
        after_values: entry.after_values ?? null,
        error: entry.error ?? null,
        organization_id: entry.organization_id ?? null,
        opportunity_id: entry.opportunity_id ?? null,
        fdd_workflow_id: entry.fdd_workflow_id ?? null,
      });
      // Audit logging failures are logged loudly but must not break the flow.
      if (error) console.error(`Failed to insert FDD audit entry ${entry.event}: ${error.message}`);
    },

    async listFddAudit(leadId: string): Promise<FddAuditRecord[]> {
      const { data, error } = await db
        .from("fdd_audit_log")
        .select()
        .eq("lead_id", leadId)
        .order("created_at", { ascending: true });
      if (error) throw new Error(`Failed to load FDD audit log: ${error.message}`);
      return (data as FddAuditRecord[]) ?? [];
    },

    async hasFddAuditEvent(externalEventId: string): Promise<boolean> {
      const { data, error } = await db
        .from("fdd_audit_log")
        .select("id")
        .eq("external_event_id", externalEventId)
        .limit(1);
      if (error) throw new Error(`Failed to check FDD event: ${error.message}`);
      return Boolean(data && data.length > 0);
    },

    async resetLeadProgress(leadId: string): Promise<void> {
      await db.from("video_progress").delete().eq("lead_id", leadId);
      await db.from("questionnaire_responses").delete().eq("lead_id", leadId);
      await db.from("fdd_audit_log").delete().eq("lead_id", leadId);
      // Development helper only: reset the primary opportunity's mirrored
      // state so the demo flow replays cleanly end to end.
      const { data: opportunity } = await db
        .from("opportunities")
        .select("id")
        .eq("source_lead_id", leadId)
        .maybeSingle();
      if (opportunity) {
        await db.from("opportunity_fdd_workflows").delete().eq("opportunity_id", opportunity.id);
        await db
          .from("opportunities")
          .update({
            stage: "NEW_LEAD",
            qualification_score: null,
            qualification_result: null,
            qualification_reasons: null,
            last_activity_at: null,
            updated_at: nowIso(),
          })
          .eq("id", opportunity.id);
      }
      await db
        .from("leads")
        .update({
          status: "created",
          current_stage: "NEW_LEAD",
          last_activity_at: null,
          qualification_score: null,
          qualification_result: null,
          qualification_reasons: null,
          portal_first_opened_at: null,
          video_started_at: null,
          video_completed_at: null,
          questionnaire_started_at: null,
          questionnaire_completed_at: null,
          qualified_at: null,
          calendar_viewed_at: null,
          booked_at: null,
          appointment_id: null,
          appointment_start_at: null,
          fdd_status: "not_requested",
          fdd_requested_at: null,
          fdd_sent_at: null,
          fdd_delivered_at: null,
          fdd_received_at: null,
          fdd_eligible_at: null,
          fdd_provider_envelope_id: null,
          fdd_workflow_id: null,
          fdd_request_source: null,
          fdd_last_error: null,
          fdd_retry_count: 0,
          updated_at: nowIso(),
        })
        .eq("id", leadId);
    },

    // -----------------------------------------------------------------------
    // Advisor backend
    // -----------------------------------------------------------------------

    async listLeads(): Promise<LeadRecord[]> {
      const { data, error } = await db.from("leads").select();
      if (error) throw new Error(`Failed to list leads: ${error.message}`);
      return (data as LeadRecord[]) ?? [];
    },

    async getLeadByEmail(email: string): Promise<LeadRecord | null> {
      const { data, error } = await db
        .from("leads")
        .select()
        .ilike("email", email)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(`Failed to load lead by email: ${error.message}`);
      return (data as LeadRecord | null) ?? null;
    },

    async listQuestionnaires(): Promise<QuestionnaireRecord[]> {
      const { data, error } = await db.from("questionnaire_responses").select();
      if (error) throw new Error(`Failed to list questionnaires: ${error.message}`);
      return (data as QuestionnaireRecord[]) ?? [];
    },

    async listVideoProgress(): Promise<VideoProgressRecord[]> {
      const { data, error } = await db.from("video_progress").select();
      if (error) throw new Error(`Failed to list video progress: ${error.message}`);
      return (data as VideoProgressRecord[]) ?? [];
    },

    async createStaffUser(input: CreateStaffUserInput): Promise<StaffUserRecord> {
      const { data, error } = await db.from("staff_users").insert(input).select().single();
      if (error) throw new Error(`Failed to create staff user: ${error.message}`);
      return data as StaffUserRecord;
    },

    async getStaffUserById(id: string): Promise<StaffUserRecord | null> {
      const { data, error } = await db.from("staff_users").select().eq("id", id).maybeSingle();
      if (error) throw new Error(`Failed to load staff user: ${error.message}`);
      return (data as StaffUserRecord | null) ?? null;
    },

    async getStaffUserByEmail(email: string): Promise<StaffUserRecord | null> {
      const { data, error } = await db
        .from("staff_users")
        .select()
        .ilike("email", email)
        .maybeSingle();
      if (error) throw new Error(`Failed to load staff user: ${error.message}`);
      return (data as StaffUserRecord | null) ?? null;
    },

    async listStaffUsers(): Promise<StaffUserRecord[]> {
      const { data, error } = await db.from("staff_users").select().order("created_at");
      if (error) throw new Error(`Failed to list staff users: ${error.message}`);
      return (data as StaffUserRecord[]) ?? [];
    },

    async updateStaffUser(id: string, patch: StaffUserPatch): Promise<StaffUserRecord> {
      const { data, error } = await db
        .from("staff_users")
        .update({ ...patch, updated_at: nowIso() })
        .eq("id", id)
        .select()
        .single();
      if (error) throw new Error(`Failed to update staff user: ${error.message}`);
      return data as StaffUserRecord;
    },

    async createStaffSession(staffUserId: string, tokenHash: string, expiresAt: string): Promise<void> {
      const { error } = await db.from("staff_sessions").insert({
        staff_user_id: staffUserId,
        token_hash: tokenHash,
        expires_at: expiresAt,
      });
      if (error) throw new Error(`Failed to create session: ${error.message}`);
    },

    async getStaffSessionByHash(tokenHash: string): Promise<StaffSessionRecord | null> {
      const { data, error } = await db
        .from("staff_sessions")
        .select()
        .eq("token_hash", tokenHash)
        .maybeSingle();
      if (error) throw new Error(`Failed to load session: ${error.message}`);
      return (data as StaffSessionRecord | null) ?? null;
    },

    async deleteStaffSession(tokenHash: string): Promise<void> {
      await db.from("staff_sessions").delete().eq("token_hash", tokenHash);
    },

    async createSubmission(input: CreateSubmissionInput): Promise<QuestionnaireSubmissionWithAnswers> {
      const { data, error } = await db
        .from("questionnaire_submissions")
        .insert({
          lead_id: input.lead_id,
          questionnaire_version: input.questionnaire_version,
          submitted_at: input.submitted_at,
          organization_id: input.organization_id ?? null,
          client_id: input.client_id ?? null,
          opportunity_id: input.opportunity_id ?? null,
          brand_id: input.brand_id ?? null,
        })
        .select()
        .single();
      if (error) throw new Error(`Failed to create submission: ${error.message}`);
      const submission = data as QuestionnaireSubmissionRecord;

      const { data: answers, error: answersError } = await db
        .from("questionnaire_answers")
        .insert(input.answers.map((a) => ({ ...a, submission_id: submission.id })))
        .select();
      if (answersError) throw new Error(`Failed to store answers: ${answersError.message}`);
      return { ...submission, answers: (answers as QuestionnaireAnswerRecord[]) ?? [] };
    },

    async getSubmissionsForLead(leadId: string): Promise<QuestionnaireSubmissionWithAnswers[]> {
      const { data, error } = await db
        .from("questionnaire_submissions")
        .select("*, answers:questionnaire_answers(*)")
        .eq("lead_id", leadId)
        .order("submitted_at", { ascending: false });
      if (error) throw new Error(`Failed to load submissions: ${error.message}`);
      return (data as QuestionnaireSubmissionWithAnswers[]) ?? [];
    },

    async createNote(leadId, staffUserId, note, links): Promise<AdvisorNoteRecord> {
      const { data, error } = await db
        .from("advisor_notes")
        .insert({
          lead_id: leadId,
          staff_user_id: staffUserId,
          note,
          organization_id: links?.organization_id ?? null,
          client_id: links?.client_id ?? null,
          opportunity_id: links?.opportunity_id ?? null,
          author_profile_id: links?.author_profile_id ?? null,
        })
        .select()
        .single();
      if (error) throw new Error(`Failed to create note: ${error.message}`);
      return data as AdvisorNoteRecord;
    },

    async getNotesForLead(leadId: string): Promise<AdvisorNoteRecord[]> {
      const { data, error } = await db
        .from("advisor_notes")
        .select()
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false });
      if (error) throw new Error(`Failed to load notes: ${error.message}`);
      return (data as AdvisorNoteRecord[]) ?? [];
    },

    async createAppointment(input: CreateAppointmentInput): Promise<AppointmentRecord> {
      const { data, error } = await db
        .from("appointments")
        .insert({ status: "SCHEDULED", ...input })
        .select()
        .single();
      if (error) throw new Error(`Failed to create appointment: ${error.message}`);
      return data as AppointmentRecord;
    },

    async updateAppointment(id: string, patch: AppointmentPatch): Promise<AppointmentRecord> {
      const { data, error } = await db
        .from("appointments")
        .update({ ...patch, updated_at: nowIso() })
        .eq("id", id)
        .select()
        .single();
      if (error) throw new Error(`Failed to update appointment: ${error.message}`);
      return data as AppointmentRecord;
    },

    async getAppointmentsForLead(leadId: string): Promise<AppointmentRecord[]> {
      const { data, error } = await db
        .from("appointments")
        .select()
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false });
      if (error) throw new Error(`Failed to load appointments: ${error.message}`);
      return (data as AppointmentRecord[]) ?? [];
    },

    async getAppointmentByExternalId(externalId: string): Promise<AppointmentRecord | null> {
      const { data, error } = await db
        .from("appointments")
        .select()
        .eq("external_appointment_id", externalId)
        .maybeSingle();
      if (error) throw new Error(`Failed to load appointment: ${error.message}`);
      return (data as AppointmentRecord | null) ?? null;
    },

    async listAppointments(): Promise<AppointmentRecord[]> {
      const { data, error } = await db.from("appointments").select();
      if (error) throw new Error(`Failed to list appointments: ${error.message}`);
      return (data as AppointmentRecord[]) ?? [];
    },

    async getEventsForLead(leadId: string): Promise<PortalEventRecord[]> {
      const { data, error } = await db
        .from("portal_events")
        .select()
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false });
      if (error) throw new Error(`Failed to load events: ${error.message}`);
      return (data as PortalEventRecord[]) ?? [];
    },

    // -----------------------------------------------------------------------
    // Platform domain
    // -----------------------------------------------------------------------

    async createOrganization(input) {
      const { data, error } = await db.from("organizations").insert(input).select().single();
      if (error) throw new Error(`Failed to create organization: ${error.message}`);
      return data as OrganizationRecord;
    },

    async getOrganizationById(id) {
      const { data, error } = await db.from("organizations").select().eq("id", id).maybeSingle();
      if (error) throw new Error(`Failed to load organization: ${error.message}`);
      return (data as OrganizationRecord | null) ?? null;
    },

    async getOrganizationBySlug(slug) {
      const { data, error } = await db
        .from("organizations")
        .select()
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw new Error(`Failed to load organization: ${error.message}`);
      return (data as OrganizationRecord | null) ?? null;
    },

    async createProfile(input) {
      const { data, error } = await db.from("profiles").insert(input).select().single();
      if (error) throw new Error(`Failed to create profile: ${error.message}`);
      return data as ProfileRecord;
    },

    async getProfileById(id) {
      const { data, error } = await db.from("profiles").select().eq("id", id).maybeSingle();
      if (error) throw new Error(`Failed to load profile: ${error.message}`);
      return (data as ProfileRecord | null) ?? null;
    },

    async getProfileByLegacyStaffUserId(staffUserId) {
      const { data, error } = await db
        .from("profiles")
        .select()
        .eq("legacy_staff_user_id", staffUserId)
        .maybeSingle();
      if (error) throw new Error(`Failed to load profile: ${error.message}`);
      return (data as ProfileRecord | null) ?? null;
    },

    async getProfileByEmail(email) {
      const { data, error } = await db
        .from("profiles")
        .select()
        .ilike("email", email)
        .maybeSingle();
      if (error) throw new Error(`Failed to load profile: ${error.message}`);
      return (data as ProfileRecord | null) ?? null;
    },

    async listProfiles() {
      const { data, error } = await db.from("profiles").select().order("created_at");
      if (error) throw new Error(`Failed to list profiles: ${error.message}`);
      return (data as ProfileRecord[]) ?? [];
    },

    async createMembership(input) {
      const { data, error } = await db
        .from("organization_memberships")
        .insert(input)
        .select()
        .single();
      if (error) throw new Error(`Failed to create membership: ${error.message}`);
      return data as OrganizationMembershipRecord;
    },

    async getMembership(organizationId, profileId) {
      const { data, error } = await db
        .from("organization_memberships")
        .select()
        .eq("organization_id", organizationId)
        .eq("profile_id", profileId)
        .maybeSingle();
      if (error) throw new Error(`Failed to load membership: ${error.message}`);
      return (data as OrganizationMembershipRecord | null) ?? null;
    },

    async listMembershipsForProfile(profileId) {
      const { data, error } = await db
        .from("organization_memberships")
        .select()
        .eq("profile_id", profileId);
      if (error) throw new Error(`Failed to list memberships: ${error.message}`);
      return (data as OrganizationMembershipRecord[]) ?? [];
    },

    async listMembershipsForOrganization(organizationId) {
      const { data, error } = await db
        .from("organization_memberships")
        .select()
        .eq("organization_id", organizationId);
      if (error) throw new Error(`Failed to list memberships: ${error.message}`);
      return (data as OrganizationMembershipRecord[]) ?? [];
    },

    async createClient(input) {
      const { data, error } = await db.from("clients").insert(input).select().single();
      if (error) throw new Error(`Failed to create client: ${error.message}`);
      return data as ClientRecord;
    },

    async getClientById(id) {
      const { data, error } = await db.from("clients").select().eq("id", id).maybeSingle();
      if (error) throw new Error(`Failed to load client: ${error.message}`);
      return (data as ClientRecord | null) ?? null;
    },

    async getClientBySourceLeadId(leadId) {
      const { data, error } = await db
        .from("clients")
        .select()
        .eq("source_lead_id", leadId)
        .maybeSingle();
      if (error) throw new Error(`Failed to load client: ${error.message}`);
      return (data as ClientRecord | null) ?? null;
    },

    async updateClient(id, patch) {
      const { data, error } = await db
        .from("clients")
        .update({ ...patch, updated_at: nowIso() })
        .eq("id", id)
        .select()
        .single();
      if (error) throw new Error(`Failed to update client: ${error.message}`);
      return data as ClientRecord;
    },

    async listClients(organizationId) {
      const { data, error } = await db
        .from("clients")
        .select()
        .eq("organization_id", organizationId);
      if (error) throw new Error(`Failed to list clients: ${error.message}`);
      return (data as ClientRecord[]) ?? [];
    },

    async findClientsByEmail(organizationId, email) {
      const { data, error } = await db
        .from("clients")
        .select()
        .eq("organization_id", organizationId)
        .ilike("email", email);
      if (error) throw new Error(`Failed to search clients: ${error.message}`);
      return (data as ClientRecord[]) ?? [];
    },

    async createOpportunity(input) {
      const { data, error } = await db.from("opportunities").insert(input).select().single();
      if (error) throw new Error(`Failed to create opportunity: ${error.message}`);
      return data as OpportunityRecord;
    },

    async getOpportunityById(id) {
      const { data, error } = await db.from("opportunities").select().eq("id", id).maybeSingle();
      if (error) throw new Error(`Failed to load opportunity: ${error.message}`);
      return (data as OpportunityRecord | null) ?? null;
    },

    async getOpportunityBySourceLeadId(leadId) {
      const { data, error } = await db
        .from("opportunities")
        .select()
        .eq("source_lead_id", leadId)
        .maybeSingle();
      if (error) throw new Error(`Failed to load opportunity: ${error.message}`);
      return (data as OpportunityRecord | null) ?? null;
    },

    async updateOpportunity(id, patch) {
      const { data, error } = await db
        .from("opportunities")
        .update({ ...patch, updated_at: nowIso() })
        .eq("id", id)
        .select()
        .single();
      if (error) throw new Error(`Failed to update opportunity: ${error.message}`);
      return data as OpportunityRecord;
    },

    async listOpportunitiesForClient(clientId) {
      const { data, error } = await db
        .from("opportunities")
        .select()
        .eq("client_id", clientId)
        .order("created_at");
      if (error) throw new Error(`Failed to list opportunities: ${error.message}`);
      return (data as OpportunityRecord[]) ?? [];
    },

    async listOpportunities(organizationId) {
      const { data, error } = await db
        .from("opportunities")
        .select()
        .eq("organization_id", organizationId);
      if (error) throw new Error(`Failed to list opportunities: ${error.message}`);
      return (data as OpportunityRecord[]) ?? [];
    },

    async createOpportunityAssignment(input) {
      const { data, error } = await db
        .from("opportunity_assignments")
        .insert(input)
        .select()
        .single();
      if (error) throw new Error(`Failed to create assignment: ${error.message}`);
      return data as OpportunityAssignmentRecord;
    },

    async listAssignmentsForOpportunity(opportunityId) {
      const { data, error } = await db
        .from("opportunity_assignments")
        .select()
        .eq("opportunity_id", opportunityId)
        .order("assigned_at");
      if (error) throw new Error(`Failed to list assignments: ${error.message}`);
      return (data as OpportunityAssignmentRecord[]) ?? [];
    },

    async upsertExternalMapping(input) {
      const { data, error } = await db
        .from("external_record_mappings")
        .upsert(
          {
            organization_id: input.organization_id,
            provider: input.provider,
            entity_type: input.entity_type,
            internal_entity_id: input.internal_entity_id,
            external_id: input.external_id,
            external_parent_id: input.external_parent_id ?? null,
            metadata: input.metadata ?? {},
            last_synced_at: nowIso(),
            updated_at: nowIso(),
          },
          { onConflict: "organization_id,provider,entity_type,external_id" },
        )
        .select()
        .single();
      if (error) throw new Error(`Failed to upsert external mapping: ${error.message}`);
      return data as ExternalRecordMappingRecord;
    },

    async getExternalMapping(organizationId, provider, entityType, externalId) {
      const { data, error } = await db
        .from("external_record_mappings")
        .select()
        .eq("organization_id", organizationId)
        .eq("provider", provider)
        .eq("entity_type", entityType)
        .eq("external_id", externalId)
        .maybeSingle();
      if (error) throw new Error(`Failed to load external mapping: ${error.message}`);
      return (data as ExternalRecordMappingRecord | null) ?? null;
    },

    async listMappingsForEntity(internalEntityId) {
      const { data, error } = await db
        .from("external_record_mappings")
        .select()
        .eq("internal_entity_id", internalEntityId);
      if (error) throw new Error(`Failed to list external mappings: ${error.message}`);
      return (data as ExternalRecordMappingRecord[]) ?? [];
    },

    async createIntegrationConnection(input) {
      const { data, error } = await db
        .from("integration_connections")
        .insert(input)
        .select()
        .single();
      if (error) throw new Error(`Failed to create integration connection: ${error.message}`);
      return data as IntegrationConnectionRecord;
    },

    async listIntegrationConnections(organizationId) {
      const { data, error } = await db
        .from("integration_connections")
        .select()
        .eq("organization_id", organizationId);
      if (error) throw new Error(`Failed to list integration connections: ${error.message}`);
      return (data as IntegrationConnectionRecord[]) ?? [];
    },

    async insertActivityEvent(input) {
      const row = {
        organization_id: input.organization_id,
        client_id: input.client_id ?? null,
        lead_id: input.lead_id ?? null,
        opportunity_id: input.opportunity_id ?? null,
        actor_profile_id: input.actor_profile_id ?? null,
        event_type: input.event_type,
        event_source: input.event_source,
        event_data: input.event_data ?? {},
        page_url: input.page_url ?? null,
        external_event_id: input.external_event_id ?? null,
        occurred_at: input.occurred_at ?? nowIso(),
      };
      const { data, error } = await db.from("activity_events").insert(row).select().single();
      if (error) {
        // Duplicate external events are silently dropped (unique index);
        // other failures are logged — activity logging never breaks a flow.
        if (error.code === "23505") return null;
        console.error(`Failed to insert activity event ${input.event_type}: ${error.message}`);
        return null;
      }
      return data as ActivityEventRecord;
    },

    async listActivityForOpportunity(opportunityId) {
      const { data, error } = await db
        .from("activity_events")
        .select()
        .eq("opportunity_id", opportunityId)
        .order("occurred_at", { ascending: false });
      if (error) throw new Error(`Failed to list activity: ${error.message}`);
      return (data as ActivityEventRecord[]) ?? [];
    },

    async listActivityForClient(clientId) {
      const { data, error } = await db
        .from("activity_events")
        .select()
        .eq("client_id", clientId)
        .order("occurred_at", { ascending: false });
      if (error) throw new Error(`Failed to list activity: ${error.message}`);
      return (data as ActivityEventRecord[]) ?? [];
    },

    async hasActivityExternalEvent(organizationId, eventSource, externalEventId) {
      const { data, error } = await db
        .from("activity_events")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("event_source", eventSource)
        .eq("external_event_id", externalEventId)
        .limit(1);
      if (error) throw new Error(`Failed to check activity event: ${error.message}`);
      return Boolean(data && data.length > 0);
    },

    async createNotificationDelivery(input) {
      const row = {
        organization_id: input.organization_id ?? null,
        lead_id: input.lead_id ?? null,
        activity_event_id: input.activity_event_id ?? null,
        event_type: input.event_type,
        channel: input.channel,
        template_key: input.template_key,
        recipient: input.recipient ?? null,
        status: input.status ?? "pending",
        dedupe_key: input.dedupe_key,
      };
      const { data, error } = await db
        .from("notification_deliveries")
        .insert(row)
        .select()
        .single();
      if (error) {
        // 23505 = the dedupe key is already claimed, i.e. this notification
        // has been handled. That is the idempotency guarantee working, not a
        // failure, so it is not logged as one.
        if (error.code === "23505") return null;
        console.error(
          `Failed to create notification delivery for ${input.event_type}: ${error.message}`,
        );
        return null;
      }
      return data as NotificationDeliveryRecord;
    },

    async updateNotificationDelivery(id, patch) {
      const { data, error } = await db
        .from("notification_deliveries")
        .update({ ...patch, updated_at: nowIso() })
        .eq("id", id)
        .select()
        .single();
      if (error) {
        console.error(`Failed to update notification delivery ${id}: ${error.message}`);
        return null;
      }
      return data as NotificationDeliveryRecord;
    },

    async listNotificationDeliveriesForLead(leadId) {
      const { data, error } = await db
        .from("notification_deliveries")
        .select()
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false });
      if (error) throw new Error(`Failed to list notification deliveries: ${error.message}`);
      return (data ?? []) as NotificationDeliveryRecord[];
    },

    async createFddWorkflow(input) {
      const { data, error } = await db
        .from("opportunity_fdd_workflows")
        .insert(input)
        .select()
        .single();
      if (error) throw new Error(`Failed to create FDD workflow: ${error.message}`);
      return data as OpportunityFddWorkflowRecord;
    },

    async getFddWorkflowByOpportunityId(opportunityId) {
      const { data, error } = await db
        .from("opportunity_fdd_workflows")
        .select()
        .eq("opportunity_id", opportunityId)
        .maybeSingle();
      if (error) throw new Error(`Failed to load FDD workflow: ${error.message}`);
      return (data as OpportunityFddWorkflowRecord | null) ?? null;
    },

    async updateFddWorkflow(id, patch) {
      const { data, error } = await db
        .from("opportunity_fdd_workflows")
        .update({ ...patch, updated_at: nowIso() })
        .eq("id", id)
        .select()
        .single();
      if (error) throw new Error(`Failed to update FDD workflow: ${error.message}`);
      return data as OpportunityFddWorkflowRecord;
    },

    async listFddWorkflows(organizationId) {
      const { data, error } = await db
        .from("opportunity_fdd_workflows")
        .select()
        .eq("organization_id", organizationId);
      if (error) throw new Error(`Failed to list FDD workflows: ${error.message}`);
      return (data as OpportunityFddWorkflowRecord[]) ?? [];
    },
    // -----------------------------------------------------------------------
    // Territory Advisor
    // -----------------------------------------------------------------------

    async getBrandBySlug(slug: string): Promise<FranchiseBrandRecord | null> {
      const { data, error } = await db.from("franchise_brands").select().eq("slug", slug).maybeSingle();
      if (error) throw new Error(`Failed to load brand: ${error.message}`);
      return (data as FranchiseBrandRecord | null) ?? null;
    },

    async getBrandById(id: string): Promise<FranchiseBrandRecord | null> {
      const { data, error } = await db.from("franchise_brands").select().eq("id", id).maybeSingle();
      if (error) throw new Error(`Failed to load brand: ${error.message}`);
      return (data as FranchiseBrandRecord | null) ?? null;
    },

    async listBrands(): Promise<FranchiseBrandRecord[]> {
      const { data, error } = await db.from("franchise_brands").select().order("name");
      if (error) throw new Error(`Failed to list brands: ${error.message}`);
      return (data as FranchiseBrandRecord[]) ?? [];
    },

    async createBrand(input: CreateFranchiseBrandInput): Promise<FranchiseBrandRecord> {
      const { data, error } = await db
        .from("franchise_brands")
        .insert({ active: true, default_radius_miles: 10, ...input })
        .select()
        .single();
      if (error) throw new Error(`Failed to create brand: ${error.message}`);
      return data as FranchiseBrandRecord;
    },

    async getStateEligibility(
      brandId: string,
      stateCode: string,
    ): Promise<BrandStateEligibilityRecord | null> {
      const { data, error } = await db
        .from("brand_state_eligibility")
        .select()
        .eq("brand_id", brandId)
        .eq("state_code", stateCode.toUpperCase())
        .maybeSingle();
      if (error) throw new Error(`Failed to load state eligibility: ${error.message}`);
      return (data as BrandStateEligibilityRecord | null) ?? null;
    },

    async listStateEligibility(brandId: string): Promise<BrandStateEligibilityRecord[]> {
      const { data, error } = await db
        .from("brand_state_eligibility")
        .select()
        .eq("brand_id", brandId)
        .order("state_code");
      if (error) throw new Error(`Failed to list state eligibility: ${error.message}`);
      return (data as BrandStateEligibilityRecord[]) ?? [];
    },

    async upsertStateEligibility(
      input: UpsertStateEligibilityInput,
    ): Promise<BrandStateEligibilityRecord> {
      const { data, error } = await db
        .from("brand_state_eligibility")
        .upsert(
          {
            brand_id: input.brand_id,
            state_code: input.state_code.toUpperCase(),
            status: input.status,
            effective_date: input.effective_date ?? null,
            expiration_date: input.expiration_date ?? null,
            notes_internal: input.notes_internal ?? null,
            updated_at: nowIso(),
          },
          { onConflict: "brand_id,state_code" },
        )
        .select()
        .single();
      if (error) throw new Error(`Failed to save state eligibility: ${error.message}`);
      return data as BrandStateEligibilityRecord;
    },

    async listTerritoryDefinitions(brandId: string): Promise<TerritoryDefinitionRecord[]> {
      const { data, error } = await db
        .from("territory_definitions")
        .select()
        .eq("brand_id", brandId);
      if (error) throw new Error(`Failed to list territory definitions: ${error.message}`);
      return (data as TerritoryDefinitionRecord[]) ?? [];
    },

    async getTerritoryDefinition(id: string): Promise<TerritoryDefinitionRecord | null> {
      const { data, error } = await db
        .from("territory_definitions")
        .select()
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(`Failed to load territory definition: ${error.message}`);
      return (data as TerritoryDefinitionRecord | null) ?? null;
    },

    async createTerritoryDefinition(
      input: CreateTerritoryDefinitionInput,
    ): Promise<TerritoryDefinitionRecord> {
      const { data, error } = await db
        .from("territory_definitions")
        .insert({ status: "available", public_display_level: "hidden", ...input })
        .select()
        .single();
      if (error) throw new Error(`Failed to create territory definition: ${error.message}`);
      return data as TerritoryDefinitionRecord;
    },

    async updateTerritoryDefinition(
      id: string,
      patch: TerritoryDefinitionPatch,
    ): Promise<TerritoryDefinitionRecord> {
      const { data, error } = await db
        .from("territory_definitions")
        .update({ ...patch, updated_at: nowIso() })
        .eq("id", id)
        .select()
        .single();
      if (error) throw new Error(`Failed to update territory definition: ${error.message}`);
      return data as TerritoryDefinitionRecord;
    },

    async listZipCodesForTerritory(territoryDefinitionId: string): Promise<TerritoryZipCodeRecord[]> {
      const { data, error } = await db
        .from("territory_zip_codes")
        .select()
        .eq("territory_definition_id", territoryDefinitionId);
      if (error) throw new Error(`Failed to list territory zip codes: ${error.message}`);
      return (data as TerritoryZipCodeRecord[]) ?? [];
    },

    async addTerritoryZipCodes(
      territoryDefinitionId: string,
      zipCodes: string[],
    ): Promise<TerritoryZipCodeRecord[]> {
      const rows = [...new Set(zipCodes.map((z) => z.trim()).filter(Boolean))].map((zip_code) => ({
        territory_definition_id: territoryDefinitionId,
        zip_code,
      }));
      if (rows.length === 0) return [];
      const { data, error } = await db
        .from("territory_zip_codes")
        .upsert(rows, { onConflict: "territory_definition_id,zip_code", ignoreDuplicates: true })
        .select();
      if (error) throw new Error(`Failed to add territory zip codes: ${error.message}`);
      return (data as TerritoryZipCodeRecord[]) ?? [];
    },

    async removeTerritoryZipCode(id: string): Promise<void> {
      const { error } = await db.from("territory_zip_codes").delete().eq("id", id);
      if (error) throw new Error(`Failed to remove territory zip code: ${error.message}`);
    },

    async getZipCodeReference(zipCode: string): Promise<ZipCodeReferenceRecord | null> {
      const { data, error } = await db
        .from("zip_code_reference")
        .select()
        .eq("zip_code", zipCode)
        .maybeSingle();
      if (error) throw new Error(`Failed to load zip code reference: ${error.message}`);
      return (data as ZipCodeReferenceRecord | null) ?? null;
    },

    async listZipCodeReferences(): Promise<ZipCodeReferenceRecord[]> {
      // zip_code_reference holds ~41k rows nationwide — well past
      // PostgREST's default per-request row cap (1,000) — so a single
      // .select() silently truncates to the first page (whatever the
      // table's default ordering puts first) instead of erroring. That
      // silent truncation is exactly the kind of bug this app has already
      // been bitten by twice at the network layer (see the truncation
      // notes in lib/geocoding/censusImport.ts and
      // lib/territory/polygonImport.ts) — same failure shape, this time
      // at the database layer.
      //
      // Pages are fetched with .range() IN PARALLEL, not sequentially: ~41
      // pages awaited one at a time (round-trip latency × 41) was itself
      // slow enough to blow a caller's own maxDuration in production (the
      // admin Census health check, calling this from a 15–30s route) — the
      // same "our own fix made the timeout worse" shape as the census
      // per-state sync fixes elsewhere in this file's callers. A cheap
      // head-count query first tells us how many pages exist, then every
      // page request fires at once.
      const PAGE_SIZE = 1000;
      const { count, error: countError } = await db
        .from("zip_code_reference")
        .select("*", { count: "exact", head: true });
      if (countError) throw new Error(`Failed to count zip code references: ${countError.message}`);
      const total = count ?? 0;
      if (total === 0) return [];

      const pageStarts: number[] = [];
      for (let from = 0; from < total; from += PAGE_SIZE) pageStarts.push(from);

      const pages = await Promise.all(
        pageStarts.map(async (from) => {
          const { data, error } = await db
            .from("zip_code_reference")
            .select()
            .range(from, from + PAGE_SIZE - 1);
          if (error) throw new Error(`Failed to list zip code references: ${error.message}`);
          return (data as ZipCodeReferenceRecord[]) ?? [];
        }),
      );
      return pages.flat();
    },

    async upsertZipCodeReferences(rows: UpsertZipCodeReferenceInput[]): Promise<void> {
      if (rows.length === 0) return;
      // PostgREST bulk upserts require identical keys on every object, and
      // only payload keys are SET on conflict (omitted demographic keys keep
      // their existing values). Group by key-shape so mixed batches work.
      const groups = new Map<string, UpsertZipCodeReferenceInput[]>();
      for (const row of rows) {
        const shape = Object.keys(row).sort().join(",");
        const group = groups.get(shape);
        if (group) group.push(row);
        else groups.set(shape, [row]);
      }
      for (const group of groups.values()) {
        const { error } = await db
          .from("zip_code_reference")
          .upsert(group, { onConflict: "zip_code" });
        if (error) throw new Error(`Failed to upsert zip code references: ${error.message}`);
      }
    },

    async upsertZipGeographies(rows): Promise<void> {
      if (rows.length === 0) return;
      const payload = rows.map((r) => ({
        zip_code: r.zip_code,
        state_code: r.state_code,
        latitude: r.latitude,
        longitude: r.longitude,
        geojson: r.geojson,
        geometry_source: r.geometry_source,
        geometry_version: r.geometry_version,
        // centroid is NOT NULL PostGIS geometry; EWKT is accepted as input.
        centroid: `SRID=4326;POINT(${r.longitude} ${r.latitude})`,
        updated_at: nowIso(),
      }));
      const { error } = await db
        .from("zip_code_geographies")
        .upsert(payload, { onConflict: "zip_code" });
      if (error) throw new Error(`Failed to upsert zip geographies: ${error.message}`);
    },

    async listZipGeographies(zipCodes): Promise<ZipGeographyRecord[]> {
      if (zipCodes.length === 0) return [];
      const out: ZipGeographyRecord[] = [];
      for (let i = 0; i < zipCodes.length; i += 200) {
        const { data, error } = await db
          .from("zip_code_geographies")
          .select("zip_code, state_code, latitude, longitude, geojson, geometry_source, geometry_version")
          .in("zip_code", zipCodes.slice(i, i + 200))
          .not("geojson", "is", null);
        if (error) throw new Error(`Failed to load zip geographies: ${error.message}`);
        out.push(...((data as ZipGeographyRecord[]) ?? []));
      }
      return out;
    },

    async hasZipGeographiesForState(stateCode: string): Promise<boolean> {
      const { data, error } = await db
        .from("zip_code_geographies")
        .select("zip_code")
        .eq("state_code", stateCode)
        .not("geojson", "is", null)
        .limit(1);
      if (error) throw new Error(`Failed to check zip geography coverage: ${error.message}`);
      return (data?.length ?? 0) > 0;
    },

    async createTerritorySearch(input: CreateTerritorySearchInput): Promise<TerritorySearchRecord> {
      const { data, error } = await db
        .from("territory_searches")
        .insert({ matched_territory_count: 0, request_manual_review: false, ...input })
        .select()
        .single();
      if (error) throw new Error(`Failed to save territory search: ${error.message}`);
      return data as TerritorySearchRecord;
    },

    async getTerritorySearch(id: string): Promise<TerritorySearchRecord | null> {
      const { data, error } = await db.from("territory_searches").select().eq("id", id).maybeSingle();
      if (error) throw new Error(`Failed to load territory search: ${error.message}`);
      return (data as TerritorySearchRecord | null) ?? null;
    },

    async listTerritorySearchesForLead(leadId: string): Promise<TerritorySearchRecord[]> {
      const { data, error } = await db
        .from("territory_searches")
        .select()
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false });
      if (error) throw new Error(`Failed to list territory searches: ${error.message}`);
      return (data as TerritorySearchRecord[]) ?? [];
    },

    async listTerritorySearches(): Promise<TerritorySearchRecord[]> {
      const { data, error } = await db
        .from("territory_searches")
        .select()
        .order("created_at", { ascending: false });
      if (error) throw new Error(`Failed to list territory searches: ${error.message}`);
      return (data as TerritorySearchRecord[]) ?? [];
    },

    async createTerritoryReviewRequest(
      input: CreateTerritoryReviewRequestInput,
    ): Promise<TerritoryReviewRequestRecord> {
      const { data, error } = await db
        .from("territory_review_requests")
        .insert({ status: "new", ...input })
        .select()
        .single();
      if (error) throw new Error(`Failed to create territory review request: ${error.message}`);
      return data as TerritoryReviewRequestRecord;
    },

    async getTerritoryReviewRequest(id: string): Promise<TerritoryReviewRequestRecord | null> {
      const { data, error } = await db
        .from("territory_review_requests")
        .select()
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(`Failed to load territory review request: ${error.message}`);
      return (data as TerritoryReviewRequestRecord | null) ?? null;
    },

    async listTerritoryReviewRequestsForLead(leadId: string): Promise<TerritoryReviewRequestRecord[]> {
      const { data, error } = await db
        .from("territory_review_requests")
        .select()
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false });
      if (error) throw new Error(`Failed to list territory review requests: ${error.message}`);
      return (data as TerritoryReviewRequestRecord[]) ?? [];
    },

    async listTerritoryReviewRequests(): Promise<TerritoryReviewRequestRecord[]> {
      const { data, error } = await db
        .from("territory_review_requests")
        .select()
        .order("created_at", { ascending: false });
      if (error) throw new Error(`Failed to list territory review requests: ${error.message}`);
      return (data as TerritoryReviewRequestRecord[]) ?? [];
    },

    async updateTerritoryReviewRequest(
      id: string,
      patch: TerritoryReviewRequestPatch,
    ): Promise<TerritoryReviewRequestRecord> {
      const { data, error } = await db
        .from("territory_review_requests")
        .update({ ...patch, updated_at: nowIso() })
        .eq("id", id)
        .select()
        .single();
      if (error) throw new Error(`Failed to update territory review request: ${error.message}`);
      return data as TerritoryReviewRequestRecord;
    },

    async createCensusImportJob(input: CreateCensusImportJobInput): Promise<CensusImportJobRecord> {
      const { data, error } = await db
        .from("census_import_jobs")
        .insert({
          status: "running",
          trigger: input.trigger,
          vintage: input.vintage,
          states_total: input.states_total,
        })
        .select()
        .single();
      if (error) throw new Error(`Failed to create census import job: ${error.message}`);
      return data as CensusImportJobRecord;
    },

    async updateCensusImportJob(id: string, patch: CensusImportJobPatch): Promise<CensusImportJobRecord> {
      const { data, error } = await db
        .from("census_import_jobs")
        .update({ ...patch, updated_at: nowIso() })
        .eq("id", id)
        .select()
        .single();
      if (error) throw new Error(`Failed to update census import job: ${error.message}`);
      return data as CensusImportJobRecord;
    },

    async getCensusImportJob(id: string): Promise<CensusImportJobRecord | null> {
      const { data, error } = await db.from("census_import_jobs").select().eq("id", id).maybeSingle();
      if (error) throw new Error(`Failed to load census import job: ${error.message}`);
      return (data as CensusImportJobRecord | null) ?? null;
    },

    async getActiveCensusImportJob(): Promise<CensusImportJobRecord | null> {
      const { data, error } = await db
        .from("census_import_jobs")
        .select()
        .eq("status", "running")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(`Failed to load active census import job: ${error.message}`);
      return (data as CensusImportJobRecord | null) ?? null;
    },

    async listCensusImportJobs(limit: number): Promise<CensusImportJobRecord[]> {
      const { data, error } = await db
        .from("census_import_jobs")
        .select()
        .order("started_at", { ascending: false })
        .limit(limit);
      if (error) throw new Error(`Failed to list census import jobs: ${error.message}`);
      return (data as CensusImportJobRecord[]) ?? [];
    },

    async recordCensusRawImport(input: RecordCensusRawImportInput): Promise<void> {
      const { error } = await db
        .from("census_acs_raw")
        .upsert(
          {
            job_id: input.job_id,
            vintage: input.vintage,
            state_code: input.state_code,
            variables: input.variables,
            payload: input.payload,
            fetched_at: nowIso(),
          },
          { onConflict: "vintage,state_code" },
        );
      if (error) throw new Error(`Failed to record raw Census import: ${error.message}`);
    },

    async countCensusAcsRaw(): Promise<number> {
      const { count, error } = await db
        .from("census_acs_raw")
        .select("*", { count: "exact", head: true });
      if (error) throw new Error(`Failed to count raw Census imports: ${error.message}`);
      return count ?? 0;
    },
  };
}
