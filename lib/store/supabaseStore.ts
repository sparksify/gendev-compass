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
  CreateLeadRecordInput,
  CreateQuestionnaireInput,
  CreateStaffUserInput,
  CreateSubmissionInput,
  InsertEventOptions,
  LeadPatch,
  PortalStore,
  StaffUserPatch,
  VideoProgressPatch,
} from "./types";
import type {
  ActivityEventRecord,
  BrandRecord,
  ClientRecord,
  ExternalRecordMappingRecord,
  IntegrationConnectionRecord,
  OpportunityAssignmentRecord,
  OpportunityFddWorkflowRecord,
  OpportunityRecord,
  OrganizationMembershipRecord,
  OrganizationRecord,
  ProfileRecord,
  TerritoryRequestRecord,
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

    async createBrand(input) {
      const { data, error } = await db.from("brands").insert(input).select().single();
      if (error) throw new Error(`Failed to create brand: ${error.message}`);
      return data as BrandRecord;
    },

    async getBrandById(id) {
      const { data, error } = await db.from("brands").select().eq("id", id).maybeSingle();
      if (error) throw new Error(`Failed to load brand: ${error.message}`);
      return (data as BrandRecord | null) ?? null;
    },

    async getBrandBySlug(organizationId, slug) {
      const { data, error } = await db
        .from("brands")
        .select()
        .eq("organization_id", organizationId)
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw new Error(`Failed to load brand: ${error.message}`);
      return (data as BrandRecord | null) ?? null;
    },

    async updateBrand(id, patch) {
      const { data, error } = await db
        .from("brands")
        .update({ ...patch, updated_at: nowIso() })
        .eq("id", id)
        .select()
        .single();
      if (error) throw new Error(`Failed to update brand: ${error.message}`);
      return data as BrandRecord;
    },

    async listBrands(organizationId) {
      const { data, error } = await db
        .from("brands")
        .select()
        .eq("organization_id", organizationId)
        .order("created_at");
      if (error) throw new Error(`Failed to list brands: ${error.message}`);
      return (data as BrandRecord[]) ?? [];
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

    async createTerritoryRequest(input) {
      const { data, error } = await db
        .from("territory_requests")
        .insert(input)
        .select()
        .single();
      if (error) throw new Error(`Failed to create territory request: ${error.message}`);
      return data as TerritoryRequestRecord;
    },

    async getTerritoryRequestById(id) {
      const { data, error } = await db
        .from("territory_requests")
        .select()
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(`Failed to load territory request: ${error.message}`);
      return (data as TerritoryRequestRecord | null) ?? null;
    },

    async listTerritoryRequestsForOpportunity(opportunityId) {
      const { data, error } = await db
        .from("territory_requests")
        .select()
        .eq("opportunity_id", opportunityId)
        .order("created_at", { ascending: false });
      if (error) throw new Error(`Failed to list territory requests: ${error.message}`);
      return (data as TerritoryRequestRecord[]) ?? [];
    },

    async updateTerritoryRequest(id, patch) {
      const { data, error } = await db
        .from("territory_requests")
        .update({ ...patch, updated_at: nowIso() })
        .eq("id", id)
        .select()
        .single();
      if (error) throw new Error(`Failed to update territory request: ${error.message}`);
      return data as TerritoryRequestRecord;
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
  };
}
