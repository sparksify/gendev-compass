import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { LeadRecord } from "@/types/lead";
import type { QuestionnaireRecord } from "@/types/questionnaire";
import type { VideoProgressRecord } from "@/types/portal";
import type { FddAuditInsert, FddAuditRecord } from "@/types/fdd";
import type {
  CreateLeadRecordInput,
  CreateQuestionnaireInput,
  LeadPatch,
  PortalStore,
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

    async insertEvent(leadId, eventName, eventData, pageUrl): Promise<void> {
      const { error } = await db.from("portal_events").insert({
        lead_id: leadId,
        event_name: eventName,
        event_data: eventData,
        page_url: pageUrl,
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
  };
}
