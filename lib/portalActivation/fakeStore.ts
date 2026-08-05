import { randomUUID } from "crypto";
import type { LeadRecord } from "@/types/lead";
import type { QuestionnaireRecord } from "@/types/questionnaire";
import type { VideoProgressRecord } from "@/types/portal";
import type { FddAuditInsert, FddAuditRecord } from "@/types/fdd";
import type {
  ActivationPatch,
  CreateActivationInput,
  CreateExternalLeadInput,
  ExternalLeadRecord,
  PortalActivationRecord,
} from "@/types/portalActivation";
import type {
  CreateLeadRecordInput,
  CreateQuestionnaireInput,
  LeadPatch,
  PortalStore,
  VideoProgressPatch,
} from "@/lib/store/types";

/**
 * In-memory PortalStore for tests — same semantics as lib/store/devStore.ts
 * (including the atomic conditional claim) but with no filesystem I/O, so
 * concurrent test calls (e.g. Promise.all racing a claim) are safe and fast.
 */
export function createFakeStore(): PortalStore {
  const leads: LeadRecord[] = [];
  const videoProgress: VideoProgressRecord[] = [];
  const questionnaires: QuestionnaireRecord[] = [];
  const fddAudit: FddAuditRecord[] = [];
  const externalLeads: ExternalLeadRecord[] = [];
  const activations: PortalActivationRecord[] = [];

  function nowIso(): string {
    return new Date().toISOString();
  }

  return {
    async createLead(input: CreateLeadRecordInput): Promise<LeadRecord> {
      const lead: LeadRecord = {
        id: randomUUID(),
        portal_token: input.portal_token,
        first_name: input.first_name,
        last_name: input.last_name,
        email: input.email,
        phone: input.phone,
        source: input.source,
        campaign: input.campaign,
        ad_set: input.ad_set,
        ad: input.ad,
        facebook_lead_id: input.facebook_lead_id,
        initial_liquid_capital: input.initial_liquid_capital,
        initial_net_worth: input.initial_net_worth,
        initial_business_owner: input.initial_business_owner,
        status: "created",
        qualification_score: null,
        qualification_result: null,
        qualification_reasons: null,
        created_at: nowIso(),
        updated_at: nowIso(),
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
        brand_slug: input.brand_slug ?? "cmdt",
        highlevel_contact_id: input.highlevel_contact_id ?? null,
        highlevel_location_id: input.highlevel_location_id ?? null,
        advisor_id: input.advisor_id ?? null,
      };
      leads.push(lead);
      return lead;
    },

    async getLeadByToken(token: string): Promise<LeadRecord | null> {
      return leads.find((l) => l.portal_token === token) ?? null;
    },

    async getLeadById(id: string): Promise<LeadRecord | null> {
      return leads.find((l) => l.id === id) ?? null;
    },

    async updateLead(id: string, patch: LeadPatch): Promise<LeadRecord> {
      const lead = leads.find((l) => l.id === id);
      if (!lead) throw new Error(`Lead not found: ${id}`);
      Object.assign(lead, patch, { updated_at: nowIso() });
      return lead;
    },

    async getVideoProgress(leadId: string): Promise<VideoProgressRecord | null> {
      return videoProgress.find((v) => v.lead_id === leadId) ?? null;
    },

    async upsertVideoProgress(leadId: string, patch: VideoProgressPatch): Promise<VideoProgressRecord> {
      let record = videoProgress.find((v) => v.lead_id === leadId);
      if (!record) {
        record = {
          id: randomUUID(),
          lead_id: leadId,
          wistia_media_id: null,
          highest_percent_watched: 0,
          accumulated_seconds_watched: 0,
          last_playhead_position: 0,
          started: false,
          completed: false,
          last_event_at: null,
          created_at: nowIso(),
          updated_at: nowIso(),
        };
        videoProgress.push(record);
      }
      Object.assign(record, patch, { updated_at: nowIso() });
      return record;
    },

    async getQuestionnaire(leadId: string): Promise<QuestionnaireRecord | null> {
      return questionnaires.find((q) => q.lead_id === leadId) ?? null;
    },

    async createQuestionnaire(input: CreateQuestionnaireInput): Promise<QuestionnaireRecord> {
      const record: QuestionnaireRecord = { id: randomUUID(), ...input, created_at: nowIso(), updated_at: nowIso() };
      questionnaires.push(record);
      return record;
    },

    async insertEvent(): Promise<void> {
      // No-op: not exercised by activation-flow tests.
    },

    async getLeadByFddEnvelopeId(): Promise<LeadRecord | null> {
      return null;
    },

    async listFddLeads(): Promise<LeadRecord[]> {
      return [];
    },

    async insertFddAudit(entry: FddAuditInsert): Promise<void> {
      fddAudit.push({
        id: randomUUID(),
        lead_id: entry.lead_id,
        event: entry.event,
        source: entry.source,
        actor: entry.actor,
        external_event_id: entry.external_event_id ?? null,
        ip_address: entry.ip_address ?? null,
        before_values: entry.before_values ?? null,
        after_values: entry.after_values ?? null,
        error: entry.error ?? null,
        created_at: nowIso(),
      });
    },

    async listFddAudit(leadId: string): Promise<FddAuditRecord[]> {
      return fddAudit.filter((e) => e.lead_id === leadId);
    },

    async hasFddAuditEvent(externalEventId: string): Promise<boolean> {
      return fddAudit.some((e) => e.external_event_id === externalEventId);
    },

    async resetLeadProgress(): Promise<void> {
      // No-op: not exercised by activation-flow tests.
    },

    async getLeadByBrandAndHighLevelContact(
      brandSlug: string,
      contactId: string,
    ): Promise<LeadRecord | null> {
      return leads.find((l) => l.brand_slug === brandSlug && l.highlevel_contact_id === contactId) ?? null;
    },

    async getLeadByBrandAndEmail(brandSlug: string, normalizedEmail: string): Promise<LeadRecord | null> {
      return (
        leads.find((l) => l.brand_slug === brandSlug && l.email.toLowerCase() === normalizedEmail) ?? null
      );
    },

    async upsertExternalLead(
      input: CreateExternalLeadInput,
    ): Promise<{ record: ExternalLeadRecord; duplicate: boolean }> {
      const existing = externalLeads.find(
        (l) =>
          l.highlevel_contact_id === input.highlevel_contact_id &&
          l.highlevel_location_id === input.highlevel_location_id &&
          l.brand_slug === input.brand_slug,
      );
      if (existing) {
        Object.assign(existing, {
          brand_slug: input.brand_slug,
          advisor_id: input.advisor_id,
          first_name: input.first_name,
          last_name: input.last_name,
          normalized_email: input.normalized_email,
          normalized_phone: input.normalized_phone,
          phone_last_four: input.phone_last_four,
          source: input.source,
          facebook_page_id: input.facebook_page_id,
          facebook_form_id: input.facebook_form_id,
          facebook_campaign_id: input.facebook_campaign_id,
          facebook_ad_id: input.facebook_ad_id,
          submitted_at: input.submitted_at,
          updated_at: nowIso(),
        });
        return { record: existing, duplicate: true };
      }
      const record: ExternalLeadRecord = {
        id: randomUUID(),
        ...input,
        claimed_at: null,
        claimed_by_activation_id: null,
        matched_lead_id: null,
        created_at: nowIso(),
        updated_at: nowIso(),
      };
      externalLeads.push(record);
      return { record, duplicate: false };
    },

    async getExternalLeadById(id: string): Promise<ExternalLeadRecord | null> {
      return externalLeads.find((l) => l.id === id) ?? null;
    },

    async findEligibleExternalLeads(
      brandSlug: string,
      startIso: string,
      endIso: string,
    ): Promise<ExternalLeadRecord[]> {
      const startMs = new Date(startIso).getTime();
      const endMs = new Date(endIso).getTime();
      return externalLeads
        .filter((l) => {
          if (l.brand_slug !== brandSlug || l.claimed_at !== null) return false;
          const receivedMs = new Date(l.received_at).getTime();
          return receivedMs >= startMs && receivedMs <= endMs;
        })
        .sort((a, b) => a.received_at.localeCompare(b.received_at));
    },

    async claimExternalLead(
      externalLeadId: string,
      activationId: string,
    ): Promise<ExternalLeadRecord | null> {
      const record = externalLeads.find((l) => l.id === externalLeadId);
      if (!record || record.claimed_at !== null) return null;
      record.claimed_at = nowIso();
      record.claimed_by_activation_id = activationId;
      record.updated_at = nowIso();
      return record;
    },

    async linkExternalLeadToPortalLead(externalLeadId: string, leadId: string): Promise<void> {
      const record = externalLeads.find((l) => l.id === externalLeadId);
      if (record) {
        record.matched_lead_id = leadId;
        record.updated_at = nowIso();
      }
    },

    async createActivation(input: CreateActivationInput): Promise<PortalActivationRecord> {
      const record: PortalActivationRecord = {
        id: randomUUID(),
        ...input,
        status: "pending",
        matched_external_lead_id: null,
        portal_lead_id: null,
        fallback_attempts: 0,
        last_match_tier: null,
        last_candidate_count: null,
        last_failure_reason: null,
        created_at: nowIso(),
        updated_at: nowIso(),
      };
      activations.push(record);
      return record;
    },

    async getActivationByPublicId(publicId: string): Promise<PortalActivationRecord | null> {
      return activations.find((a) => a.public_activation_id === publicId) ?? null;
    },

    async updateActivation(id: string, patch: ActivationPatch): Promise<PortalActivationRecord> {
      const record = activations.find((a) => a.id === id);
      if (!record) throw new Error(`Activation not found: ${id}`);
      Object.assign(record, patch, { updated_at: nowIso() });
      return record;
    },

    async listRecentActivations(limit: number): Promise<PortalActivationRecord[]> {
      return [...activations].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, limit);
    },

    async listRecentExternalLeads(limit: number): Promise<ExternalLeadRecord[]> {
      return [...externalLeads].sort((a, b) => b.received_at.localeCompare(a.received_at)).slice(0, limit);
    },
  };
}
