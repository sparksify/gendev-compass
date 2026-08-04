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
}

const DATA_DIR = path.join(process.cwd(), ".dev-data");
const DATA_FILE = path.join(DATA_DIR, "store.json");

const EMPTY: DevData = {
  leads: [],
  video_progress: [],
  questionnaire_responses: [],
  portal_events: [],
};

async function readData(): Promise<DevData> {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    return { ...EMPTY, ...(JSON.parse(raw) as Partial<DevData>) };
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

    async resetLeadProgress(leadId: string): Promise<void> {
      await withLock(async () => {
        const data = await readData();
        data.video_progress = data.video_progress.filter((v) => v.lead_id !== leadId);
        data.questionnaire_responses = data.questionnaire_responses.filter(
          (q) => q.lead_id !== leadId,
        );
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
            updated_at: nowIso(),
          });
        }
        await writeData(data);
      });
    },
  };
}
