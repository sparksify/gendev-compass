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
  FranchiseBrandRecord,
  TerritoryDefinitionRecord,
  TerritoryReviewRequestRecord,
  TerritorySearchRecord,
  TerritoryZipCodeRecord,
  ZipCodeReferenceRecord,
} from "@/types/territory";

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

    async createNote(leadId: string, staffUserId: string, note: string): Promise<AdvisorNoteRecord> {
      const { data, error } = await db
        .from("advisor_notes")
        .insert({ lead_id: leadId, staff_user_id: staffUserId, note })
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
      const { data, error } = await db.from("zip_code_reference").select();
      if (error) throw new Error(`Failed to list zip code references: ${error.message}`);
      return (data as ZipCodeReferenceRecord[]) ?? [];
    },

    async upsertZipCodeReferences(rows: ZipCodeReferenceRecord[]): Promise<void> {
      if (rows.length === 0) return;
      const { error } = await db.from("zip_code_reference").upsert(rows, { onConflict: "zip_code" });
      if (error) throw new Error(`Failed to upsert zip code references: ${error.message}`);
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
  };
}
