import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { LeadRecord } from "@/types/lead";
import type { QuestionnaireRecord } from "@/types/questionnaire";
import type { VideoProgressRecord } from "@/types/portal";
import type { PortalEventRecord } from "@/types/analytics";
import type {
  AdvisorNoteRecord,
  AppointmentRecord,
  FddRecordRow,
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
  FddRecordPatch,
  InsertEventOptions,
  LeadPatch,
  PortalStore,
  StaffUserPatch,
  VideoProgressPatch,
} from "./types";

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

    async resetLeadProgress(leadId: string): Promise<void> {
      await db.from("video_progress").delete().eq("lead_id", leadId);
      await db.from("questionnaire_responses").delete().eq("lead_id", leadId);
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
          fdd_requested_at: null,
          fdd_acknowledged_at: null,
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

    async getFddRecordForLead(leadId: string): Promise<FddRecordRow | null> {
      const { data, error } = await db
        .from("fdd_records")
        .select()
        .eq("lead_id", leadId)
        .maybeSingle();
      if (error) throw new Error(`Failed to load FDD record: ${error.message}`);
      return (data as FddRecordRow | null) ?? null;
    },

    async upsertFddRecord(leadId: string, patch: FddRecordPatch): Promise<FddRecordRow> {
      const existing = await this.getFddRecordForLead(leadId);
      if (existing) {
        const { data, error } = await db
          .from("fdd_records")
          .update({ ...patch, updated_at: nowIso() })
          .eq("lead_id", leadId)
          .select()
          .single();
        if (error) throw new Error(`Failed to update FDD record: ${error.message}`);
        return data as FddRecordRow;
      }
      const { data, error } = await db
        .from("fdd_records")
        .insert({ lead_id: leadId, status: "NOT_REQUESTED", ...patch })
        .select()
        .single();
      if (error) throw new Error(`Failed to create FDD record: ${error.message}`);
      return data as FddRecordRow;
    },

    async listFddRecords(): Promise<FddRecordRow[]> {
      const { data, error } = await db.from("fdd_records").select();
      if (error) throw new Error(`Failed to list FDD records: ${error.message}`);
      return (data as FddRecordRow[]) ?? [];
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
  };
}
