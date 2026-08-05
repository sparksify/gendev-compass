import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type { LeadRecord } from "@/types/lead";
import type { QuestionnaireRecord } from "@/types/questionnaire";
import type { VideoProgressRecord } from "@/types/portal";
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
  staff_users: StaffUserRecord[];
  staff_sessions: StaffSessionRecord[];
  questionnaire_submissions: QuestionnaireSubmissionRecord[];
  questionnaire_answers: QuestionnaireAnswerRecord[];
  advisor_notes: AdvisorNoteRecord[];
  appointments: AppointmentRecord[];
  fdd_audit_log: FddAuditRecord[];
}

const DATA_DIR = path.join(process.cwd(), ".dev-data");
const DATA_FILE = path.join(DATA_DIR, "store.json");

const EMPTY: DevData = {
  leads: [],
  video_progress: [],
  questionnaire_responses: [],
  portal_events: [],
  staff_users: [],
  staff_sessions: [],
  questionnaire_submissions: [],
  questionnaire_answers: [],
  advisor_notes: [],
  appointments: [],
  fdd_audit_log: [],
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
    // Backfill FDD defaults for leads created before the FDD workflow existed.
    data.leads = data.leads.map((lead) => ({ ...FDD_DEFAULTS, ...lead }));
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
          state: null,
          ...input,
          status: "created",
          current_stage: "NEW_LEAD",
          assigned_advisor_id: null,
          last_activity_at: nowIso(),
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
            play_count: 0,
            first_played_at: null,
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

    async insertEvent(leadId, eventName, eventData, pageUrl, options?: InsertEventOptions): Promise<void> {
      await withLock(async () => {
        const data = await readData();
        data.portal_events.push({
          id: randomUUID(),
          lead_id: leadId,
          event_name: eventName,
          event_data: eventData,
          page_url: pageUrl,
          event_source: options?.source ?? "portal",
          created_by_staff_user_id: options?.staffUserId ?? null,
          occurred_at: options?.occurredAt ?? null,
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
            ...FDD_DEFAULTS,
            updated_at: nowIso(),
          });
        }
        await writeData(data);
      });
    },

    // -----------------------------------------------------------------------
    // Advisor backend
    // -----------------------------------------------------------------------

    async listLeads(): Promise<LeadRecord[]> {
      return (await readData()).leads;
    },

    async getLeadByEmail(email: string): Promise<LeadRecord | null> {
      const data = await readData();
      const target = email.toLowerCase();
      const matches = data.leads
        .filter((l) => l.email.toLowerCase() === target)
        .sort((a, b) => a.created_at.localeCompare(b.created_at));
      return matches[0] ?? null;
    },

    async listQuestionnaires(): Promise<QuestionnaireRecord[]> {
      return (await readData()).questionnaire_responses;
    },

    async listVideoProgress(): Promise<VideoProgressRecord[]> {
      return (await readData()).video_progress;
    },

    async createStaffUser(input: CreateStaffUserInput): Promise<StaffUserRecord> {
      return withLock(async () => {
        const data = await readData();
        if (data.staff_users.some((u) => u.email.toLowerCase() === input.email.toLowerCase())) {
          throw new Error(`Staff user already exists: ${input.email}`);
        }
        const user: StaffUserRecord = {
          id: randomUUID(),
          ...input,
          active: true,
          created_at: nowIso(),
          updated_at: nowIso(),
          last_login_at: null,
        };
        data.staff_users.push(user);
        await writeData(data);
        return user;
      });
    },

    async getStaffUserById(id: string): Promise<StaffUserRecord | null> {
      return (await readData()).staff_users.find((u) => u.id === id) ?? null;
    },

    async getStaffUserByEmail(email: string): Promise<StaffUserRecord | null> {
      const target = email.toLowerCase();
      return (
        (await readData()).staff_users.find((u) => u.email.toLowerCase() === target) ?? null
      );
    },

    async listStaffUsers(): Promise<StaffUserRecord[]> {
      return (await readData()).staff_users;
    },

    async updateStaffUser(id: string, patch: StaffUserPatch): Promise<StaffUserRecord> {
      return withLock(async () => {
        const data = await readData();
        const user = data.staff_users.find((u) => u.id === id);
        if (!user) throw new Error(`Staff user not found: ${id}`);
        Object.assign(user, patch, { updated_at: nowIso() });
        await writeData(data);
        return user;
      });
    },

    async createStaffSession(staffUserId: string, tokenHash: string, expiresAt: string): Promise<void> {
      await withLock(async () => {
        const data = await readData();
        data.staff_sessions.push({
          id: randomUUID(),
          staff_user_id: staffUserId,
          token_hash: tokenHash,
          expires_at: expiresAt,
          created_at: nowIso(),
        });
        await writeData(data);
      });
    },

    async getStaffSessionByHash(tokenHash: string): Promise<StaffSessionRecord | null> {
      return (await readData()).staff_sessions.find((s) => s.token_hash === tokenHash) ?? null;
    },

    async deleteStaffSession(tokenHash: string): Promise<void> {
      await withLock(async () => {
        const data = await readData();
        data.staff_sessions = data.staff_sessions.filter((s) => s.token_hash !== tokenHash);
        await writeData(data);
      });
    },

    async createSubmission(input: CreateSubmissionInput): Promise<QuestionnaireSubmissionWithAnswers> {
      return withLock(async () => {
        const data = await readData();
        const submission: QuestionnaireSubmissionRecord = {
          id: randomUUID(),
          lead_id: input.lead_id,
          questionnaire_version: input.questionnaire_version,
          submitted_at: input.submitted_at,
          created_at: nowIso(),
        };
        data.questionnaire_submissions.push(submission);
        const answers: QuestionnaireAnswerRecord[] = input.answers.map((a) => ({
          id: randomUUID(),
          submission_id: submission.id,
          ...a,
          created_at: nowIso(),
        }));
        data.questionnaire_answers.push(...answers);
        await writeData(data);
        return { ...submission, answers };
      });
    },

    async getSubmissionsForLead(leadId: string): Promise<QuestionnaireSubmissionWithAnswers[]> {
      const data = await readData();
      return data.questionnaire_submissions
        .filter((s) => s.lead_id === leadId)
        .sort((a, b) => b.submitted_at.localeCompare(a.submitted_at))
        .map((s) => ({
          ...s,
          answers: data.questionnaire_answers.filter((a) => a.submission_id === s.id),
        }));
    },

    async createNote(leadId: string, staffUserId: string, note: string): Promise<AdvisorNoteRecord> {
      return withLock(async () => {
        const data = await readData();
        const record: AdvisorNoteRecord = {
          id: randomUUID(),
          lead_id: leadId,
          staff_user_id: staffUserId,
          note,
          created_at: nowIso(),
          updated_at: nowIso(),
        };
        data.advisor_notes.push(record);
        await writeData(data);
        return record;
      });
    },

    async getNotesForLead(leadId: string): Promise<AdvisorNoteRecord[]> {
      return (await readData()).advisor_notes
        .filter((n) => n.lead_id === leadId)
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
    },

    async createAppointment(input: CreateAppointmentInput): Promise<AppointmentRecord> {
      return withLock(async () => {
        const data = await readData();
        const record: AppointmentRecord = {
          id: randomUUID(),
          lead_id: input.lead_id,
          advisor_id: input.advisor_id ?? null,
          external_appointment_id: input.external_appointment_id ?? null,
          scheduled_start: input.scheduled_start ?? null,
          scheduled_end: input.scheduled_end ?? null,
          time_zone: input.time_zone ?? null,
          status: input.status ?? "SCHEDULED",
          booking_url: input.booking_url ?? null,
          created_at: nowIso(),
          updated_at: nowIso(),
        };
        data.appointments.push(record);
        await writeData(data);
        return record;
      });
    },

    async updateAppointment(id: string, patch: AppointmentPatch): Promise<AppointmentRecord> {
      return withLock(async () => {
        const data = await readData();
        const record = data.appointments.find((a) => a.id === id);
        if (!record) throw new Error(`Appointment not found: ${id}`);
        Object.assign(record, patch, { updated_at: nowIso() });
        await writeData(data);
        return record;
      });
    },

    async getAppointmentsForLead(leadId: string): Promise<AppointmentRecord[]> {
      return (await readData()).appointments
        .filter((a) => a.lead_id === leadId)
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
    },

    async getAppointmentByExternalId(externalId: string): Promise<AppointmentRecord | null> {
      return (
        (await readData()).appointments.find((a) => a.external_appointment_id === externalId) ?? null
      );
    },

    async listAppointments(): Promise<AppointmentRecord[]> {
      return (await readData()).appointments;
    },

    async getEventsForLead(leadId: string): Promise<PortalEventRecord[]> {
      return (await readData()).portal_events
        .filter((e) => e.lead_id === leadId)
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
    },
  };
}
