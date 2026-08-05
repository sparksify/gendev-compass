import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type { LeadRecord } from "@/types/lead";
import type { QuestionnaireRecord } from "@/types/questionnaire";
import type { VideoProgressRecord } from "@/types/portal";
import type {
  CreateLeadRecordInput,
  CreateQuestionnaireInput,
  LeadPatch,
  PortalStore,
  VideoProgressPatch,
} from "./types";
import type { PortalEventRecord } from "@/types/analytics";
import type { FddAuditInsert, FddAuditRecord } from "@/types/fdd";
import type {
  ActivationPatch,
  CreateActivationInput,
  CreateExternalLeadInput,
  ExternalLeadRecord,
  PortalActivationRecord,
} from "@/types/portalActivation";

/**
 * File-backed development store used when Supabase is not configured.
 * Lets the entire portal flow run locally with zero external services.
 * Never used in production — see lib/store/index.ts.
 */

interface DevData {
  leads: LeadRecord[];
  video_progress: VideoProgressRecord[];
  questionnaire_responses: QuestionnaireRecord[];
  portal_events: PortalEventRecord[];
  fdd_audit_log: FddAuditRecord[];
  external_leads: ExternalLeadRecord[];
  portal_activations: PortalActivationRecord[];
}

const DATA_DIR = path.join(process.cwd(), ".dev-data");
const DATA_FILE = path.join(DATA_DIR, "store.json");

const EMPTY: DevData = {
  leads: [],
  video_progress: [],
  questionnaire_responses: [],
  portal_events: [],
  fdd_audit_log: [],
  external_leads: [],
  portal_activations: [],
};

/** Default brand/HighLevel identity fields for leads created before this flow existed. */
const BRAND_DEFAULTS = {
  brand_slug: "cmdt" as const,
  highlevel_contact_id: null,
  highlevel_location_id: null,
  advisor_id: null,
};

/** Default FDD workflow fields for new and reset leads. */
const FDD_DEFAULTS = {
  fdd_status: "not_requested" as const,
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
};

async function readData(): Promise<DevData> {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    const data = { ...EMPTY, ...(JSON.parse(raw) as Partial<DevData>) };
    // Backfill defaults for leads created before these workflows existed.
    data.leads = data.leads.map((lead) => ({ ...FDD_DEFAULTS, ...BRAND_DEFAULTS, ...lead }));
    return data;
  } catch {
    return structuredClone(EMPTY);
  }
}

async function writeData(data: DevData): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
}

// Serialize writes within this process to avoid interleaved read-modify-write.
let queue: Promise<unknown> = Promise.resolve();
function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const next = queue.then(fn, fn);
  queue = next.catch(() => undefined);
  return next;
}

function nowIso(): string {
  return new Date().toISOString();
}

export function createDevStore(): PortalStore {
  return {
    async createLead(input: CreateLeadRecordInput): Promise<LeadRecord> {
      return withLock(async () => {
        const data = await readData();
        const lead: LeadRecord = {
          id: randomUUID(),
          ...BRAND_DEFAULTS,
          ...input,
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
          ...FDD_DEFAULTS,
        };
        data.leads.push(lead);
        await writeData(data);
        return lead;
      });
    },

    async getLeadByToken(token: string): Promise<LeadRecord | null> {
      const data = await readData();
      return data.leads.find((l) => l.portal_token === token) ?? null;
    },

    async getLeadById(id: string): Promise<LeadRecord | null> {
      const data = await readData();
      return data.leads.find((l) => l.id === id) ?? null;
    },

    async updateLead(id: string, patch: LeadPatch): Promise<LeadRecord> {
      return withLock(async () => {
        const data = await readData();
        const lead = data.leads.find((l) => l.id === id);
        if (!lead) throw new Error(`Lead not found: ${id}`);
        Object.assign(lead, patch, { updated_at: nowIso() });
        await writeData(data);
        return lead;
      });
    },

    async getVideoProgress(leadId: string): Promise<VideoProgressRecord | null> {
      const data = await readData();
      return data.video_progress.find((v) => v.lead_id === leadId) ?? null;
    },

    async upsertVideoProgress(leadId: string, patch: VideoProgressPatch): Promise<VideoProgressRecord> {
      return withLock(async () => {
        const data = await readData();
        let record = data.video_progress.find((v) => v.lead_id === leadId);
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
          data.video_progress.push(record);
        }
        Object.assign(record, patch, { updated_at: nowIso() });
        await writeData(data);
        return record;
      });
    },

    async getQuestionnaire(leadId: string): Promise<QuestionnaireRecord | null> {
      const data = await readData();
      return data.questionnaire_responses.find((q) => q.lead_id === leadId) ?? null;
    },

    async createQuestionnaire(input: CreateQuestionnaireInput): Promise<QuestionnaireRecord> {
      return withLock(async () => {
        const data = await readData();
        const record: QuestionnaireRecord = {
          id: randomUUID(),
          ...input,
          created_at: nowIso(),
          updated_at: nowIso(),
        };
        data.questionnaire_responses = data.questionnaire_responses.filter(
          (q) => q.lead_id !== input.lead_id,
        );
        data.questionnaire_responses.push(record);
        await writeData(data);
        return record;
      });
    },

    async insertEvent(leadId, eventName, eventData, pageUrl): Promise<void> {
      await withLock(async () => {
        const data = await readData();
        data.portal_events.push({
          id: randomUUID(),
          lead_id: leadId,
          event_name: eventName,
          event_data: eventData,
          page_url: pageUrl,
          created_at: nowIso(),
        });
        await writeData(data);
      });
    },

    async getLeadByFddEnvelopeId(envelopeId: string): Promise<LeadRecord | null> {
      const data = await readData();
      return data.leads.find((l) => l.fdd_provider_envelope_id === envelopeId) ?? null;
    },

    async listFddLeads(): Promise<LeadRecord[]> {
      const data = await readData();
      return data.leads
        .filter((l) => l.fdd_status !== "not_requested")
        .sort((a, b) => (b.fdd_requested_at ?? "").localeCompare(a.fdd_requested_at ?? ""));
    },

    async insertFddAudit(entry: FddAuditInsert): Promise<void> {
      await withLock(async () => {
        const data = await readData();
        data.fdd_audit_log.push({
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
        await writeData(data);
      });
    },

    async listFddAudit(leadId: string): Promise<FddAuditRecord[]> {
      const data = await readData();
      return data.fdd_audit_log.filter((e) => e.lead_id === leadId);
    },

    async hasFddAuditEvent(externalEventId: string): Promise<boolean> {
      const data = await readData();
      return data.fdd_audit_log.some((e) => e.external_event_id === externalEventId);
    },

    async resetLeadProgress(leadId: string): Promise<void> {
      await withLock(async () => {
        const data = await readData();
        data.video_progress = data.video_progress.filter((v) => v.lead_id !== leadId);
        data.questionnaire_responses = data.questionnaire_responses.filter(
          (q) => q.lead_id !== leadId,
        );
        data.fdd_audit_log = data.fdd_audit_log.filter((e) => e.lead_id !== leadId);
        const lead = data.leads.find((l) => l.id === leadId);
        if (lead) {
          Object.assign(lead, {
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
            ...FDD_DEFAULTS,
            updated_at: nowIso(),
          });
        }
        await writeData(data);
      });
    },

    async getLeadByBrandAndHighLevelContact(
      brandSlug: string,
      contactId: string,
    ): Promise<LeadRecord | null> {
      const data = await readData();
      return (
        data.leads.find((l) => l.brand_slug === brandSlug && l.highlevel_contact_id === contactId) ??
        null
      );
    },

    async getLeadByBrandAndEmail(brandSlug: string, normalizedEmail: string): Promise<LeadRecord | null> {
      const data = await readData();
      return (
        data.leads.find(
          (l) => l.brand_slug === brandSlug && l.email.toLowerCase() === normalizedEmail,
        ) ?? null
      );
    },

    async upsertExternalLead(
      input: CreateExternalLeadInput,
    ): Promise<{ record: ExternalLeadRecord; duplicate: boolean }> {
      return withLock(async () => {
        const data = await readData();
        const existing = data.external_leads.find(
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
          await writeData(data);
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
        data.external_leads.push(record);
        await writeData(data);
        return { record, duplicate: false };
      });
    },

    async getExternalLeadById(id: string): Promise<ExternalLeadRecord | null> {
      const data = await readData();
      return data.external_leads.find((l) => l.id === id) ?? null;
    },

    async findEligibleExternalLeads(
      brandSlug: string,
      startIso: string,
      endIso: string,
    ): Promise<ExternalLeadRecord[]> {
      const data = await readData();
      const startMs = new Date(startIso).getTime();
      const endMs = new Date(endIso).getTime();
      return data.external_leads
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
      return withLock(async () => {
        const data = await readData();
        const record = data.external_leads.find((l) => l.id === externalLeadId);
        if (!record || record.claimed_at !== null) return null;
        record.claimed_at = nowIso();
        record.claimed_by_activation_id = activationId;
        record.updated_at = nowIso();
        await writeData(data);
        return record;
      });
    },

    async linkExternalLeadToPortalLead(externalLeadId: string, leadId: string): Promise<void> {
      await withLock(async () => {
        const data = await readData();
        const record = data.external_leads.find((l) => l.id === externalLeadId);
        if (record) {
          record.matched_lead_id = leadId;
          record.updated_at = nowIso();
          await writeData(data);
        }
      });
    },

    async createActivation(input: CreateActivationInput): Promise<PortalActivationRecord> {
      return withLock(async () => {
        const data = await readData();
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
        data.portal_activations.push(record);
        await writeData(data);
        return record;
      });
    },

    async getActivationByPublicId(publicId: string): Promise<PortalActivationRecord | null> {
      const data = await readData();
      return data.portal_activations.find((a) => a.public_activation_id === publicId) ?? null;
    },

    async updateActivation(id: string, patch: ActivationPatch): Promise<PortalActivationRecord> {
      return withLock(async () => {
        const data = await readData();
        const record = data.portal_activations.find((a) => a.id === id);
        if (!record) throw new Error(`Activation not found: ${id}`);
        Object.assign(record, patch, { updated_at: nowIso() });
        await writeData(data);
        return record;
      });
    },

    async listRecentActivations(limit: number): Promise<PortalActivationRecord[]> {
      const data = await readData();
      return [...data.portal_activations]
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, limit);
    },

    async listRecentExternalLeads(limit: number): Promise<ExternalLeadRecord[]> {
      const data = await readData();
      return [...data.external_leads]
        .sort((a, b) => b.received_at.localeCompare(a.received_at))
        .slice(0, limit);
    },
  };
}
