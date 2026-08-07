import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type { LeadRecord } from "@/types/lead";
import type { QuestionnaireRecord } from "@/types/questionnaire";
import type { VideoProgressRecord } from "@/types/portal";
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
  ListTrackingDeliveriesFilter,
  PortalStore,
  StaffUserPatch,
  TerritoryDefinitionPatch,
  TerritoryReviewRequestPatch,
  UpsertStateEligibilityInput,
  VideoProgressPatch,
} from "./types";
import type {
  ConsentRecord,
  CreateConsentInput,
  CreateTrackingDeliveryInput,
  TrackingDeliveryPatch,
  TrackingDeliveryRecord,
  TrackingSettingsPatch,
  TrackingSettingsRecord,
} from "@/types/tracking";
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
import type {
  BrandStateEligibilityRecord,
  CensusAcsRawRecord,
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
  organizations: OrganizationRecord[];
  profiles: ProfileRecord[];
  organization_memberships: OrganizationMembershipRecord[];
  clients: ClientRecord[];
  opportunities: OpportunityRecord[];
  opportunity_assignments: OpportunityAssignmentRecord[];
  external_record_mappings: ExternalRecordMappingRecord[];
  integration_connections: IntegrationConnectionRecord[];
  activity_events: ActivityEventRecord[];
  opportunity_fdd_workflows: OpportunityFddWorkflowRecord[];
  franchise_brands: FranchiseBrandRecord[];
  brand_state_eligibility: BrandStateEligibilityRecord[];
  territory_definitions: TerritoryDefinitionRecord[];
  territory_zip_codes: TerritoryZipCodeRecord[];
  zip_code_reference: ZipCodeReferenceRecord[];
  zip_code_geographies: ZipGeographyRecord[];
  territory_searches: TerritorySearchRecord[];
  territory_review_requests: TerritoryReviewRequestRecord[];
  census_import_jobs: CensusImportJobRecord[];
  census_acs_raw: CensusAcsRawRecord[];
  tracking_settings: TrackingSettingsRecord[];
  tracking_deliveries: TrackingDeliveryRecord[];
  portal_consent: ConsentRecord[];
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
  organizations: [],
  profiles: [],
  organization_memberships: [],
  clients: [],
  opportunities: [],
  opportunity_assignments: [],
  external_record_mappings: [],
  integration_connections: [],
  activity_events: [],
  opportunity_fdd_workflows: [],
  franchise_brands: [],
  brand_state_eligibility: [],
  territory_definitions: [],
  territory_zip_codes: [],
  zip_code_reference: [],
  zip_code_geographies: [],
  territory_searches: [],
  territory_review_requests: [],
  census_import_jobs: [],
  census_acs_raw: [],
  tracking_settings: [],
  tracking_deliveries: [],
  portal_consent: [],
};

/**
 * Mirrors the Territory Advisor migration's `on conflict (slug) do nothing`
 * seed of the single existing brand (CMDT).
 */
const SEED_BRAND_SLUG = "cmdt";
function ensureDefaultBrand(data: DevData): void {
  if (data.franchise_brands.length > 0) return;
  data.franchise_brands.push({
    id: randomUUID(),
    slug: SEED_BRAND_SLUG,
    name: "Complete Mobile Drug Testing",
    active: true,
    default_radius_miles: 10,
    organization_id: null,
    created_at: nowIso(),
    updated_at: nowIso(),
  });
}

/** Domain link defaults for legacy rows created before the platform model. */
const LEAD_LINK_DEFAULTS = {
  organization_id: null,
  client_id: null,
  primary_opportunity_id: null,
  brand_id: null,
};
const CHILD_LINK_DEFAULTS = {
  organization_id: null,
  client_id: null,
  opportunity_id: null,
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
    // Backfill defaults for rows created before newer schema layers existed.
    // Object.assign keeps stored values and only fills missing keys.
    data.leads = data.leads.map((lead) =>
      Object.assign({}, FDD_DEFAULTS, LEAD_LINK_DEFAULTS, lead),
    );
    data.appointments = data.appointments.map((a) =>
      Object.assign({}, CHILD_LINK_DEFAULTS, { advisor_profile_id: null }, a),
    );
    data.advisor_notes = data.advisor_notes.map((n) =>
      Object.assign({}, CHILD_LINK_DEFAULTS, { author_profile_id: null }, n),
    );
    data.questionnaire_submissions = data.questionnaire_submissions.map((q) =>
      Object.assign({}, CHILD_LINK_DEFAULTS, { brand_id: null }, q),
    );
    data.questionnaire_responses = data.questionnaire_responses.map((q) =>
      Object.assign({}, { opportunity_id: null }, q),
    );
    data.video_progress = data.video_progress.map((v) =>
      Object.assign({}, CHILD_LINK_DEFAULTS, { brand_id: null }, v),
    );
    data.fdd_audit_log = data.fdd_audit_log.map((f) =>
      Object.assign({}, { organization_id: null, opportunity_id: null, fdd_workflow_id: null }, f),
    );
    data.franchise_brands = data.franchise_brands.map((b) =>
      Object.assign({}, { organization_id: null }, b),
    );
    data.territory_searches = data.territory_searches.map((t) =>
      Object.assign({}, CHILD_LINK_DEFAULTS, t),
    );
    data.territory_review_requests = data.territory_review_requests.map((t) =>
      Object.assign({}, CHILD_LINK_DEFAULTS, t),
    );
    if (data.franchise_brands.length === 0) {
      ensureDefaultBrand(data);
      // Persist immediately so the seeded brand's id stays stable across reads.
      await writeData(data);
    }
    return data;
  } catch {
    const data = structuredClone(EMPTY);
    ensureDefaultBrand(data);
    await writeData(data);
    return data;
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
          first_utm_source: null,
          first_utm_medium: null,
          first_utm_campaign: null,
          first_utm_content: null,
          first_utm_term: null,
          first_fbclid: null,
          first_gclid: null,
          first_msclkid: null,
          first_fbp: null,
          first_fbc: null,
          first_referrer: null,
          first_landing_page: null,
          first_touch_at: null,
          facebook_campaign_id: null,
          facebook_adset_id: null,
          facebook_ad_id: null,
          facebook_form_id: null,
          facebook_page_id: null,
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
          ...LEAD_LINK_DEFAULTS,
          last_utm_source: null,
          last_utm_medium: null,
          last_utm_campaign: null,
          last_utm_content: null,
          last_utm_term: null,
          last_fbclid: null,
          last_referrer: null,
          last_landing_page: null,
          last_touch_at: null,
          advisor_presented: null,
          advisor_selected: null,
          advisor_booked: null,
          overflow_used: false,
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
            organization_id: null,
            client_id: null,
            opportunity_id: null,
            brand_id: null,
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
          opportunity_id: input.opportunity_id ?? null,
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
          organization_id: entry.organization_id ?? null,
          opportunity_id: entry.opportunity_id ?? null,
          fdd_workflow_id: entry.fdd_workflow_id ?? null,
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
        // Development helper only: reset the primary opportunity's mirrored
        // state so the demo flow replays cleanly end to end.
        const opportunity = data.opportunities.find((o) => o.source_lead_id === leadId);
        if (opportunity) {
          data.opportunity_fdd_workflows = data.opportunity_fdd_workflows.filter(
            (w) => w.opportunity_id !== opportunity.id,
          );
          Object.assign(opportunity, {
            stage: "NEW_LEAD",
            qualification_score: null,
            qualification_result: null,
            qualification_reasons: null,
            last_activity_at: null,
            updated_at: nowIso(),
          });
        }
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
          organization_id: input.organization_id ?? null,
          client_id: input.client_id ?? null,
          opportunity_id: input.opportunity_id ?? null,
          brand_id: input.brand_id ?? null,
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

    async createNote(leadId, staffUserId, note, links): Promise<AdvisorNoteRecord> {
      return withLock(async () => {
        const data = await readData();
        const record: AdvisorNoteRecord = {
          id: randomUUID(),
          lead_id: leadId,
          staff_user_id: staffUserId,
          note,
          created_at: nowIso(),
          updated_at: nowIso(),
          organization_id: links?.organization_id ?? null,
          client_id: links?.client_id ?? null,
          opportunity_id: links?.opportunity_id ?? null,
          author_profile_id: links?.author_profile_id ?? null,
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
          organization_id: input.organization_id ?? null,
          client_id: input.client_id ?? null,
          opportunity_id: input.opportunity_id ?? null,
          advisor_profile_id: input.advisor_profile_id ?? null,
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

    // -----------------------------------------------------------------------
    // Platform domain. Uniqueness rules mirror the SQL constraints in
    // 0005_platform_domain.sql so both stores behave identically.
    // -----------------------------------------------------------------------

    async createOrganization(input) {
      return withLock(async () => {
        const data = await readData();
        if (data.organizations.some((o) => o.slug === input.slug)) {
          throw new Error(`Organization slug already exists: ${input.slug}`);
        }
        const record: OrganizationRecord = {
          id: randomUUID(),
          name: input.name,
          slug: input.slug,
          organization_type: input.organization_type,
          status: input.status ?? "active",
          settings: input.settings ?? {},
          created_at: nowIso(),
          updated_at: nowIso(),
        };
        data.organizations.push(record);
        await writeData(data);
        return record;
      });
    },

    async getOrganizationById(id) {
      return (await readData()).organizations.find((o) => o.id === id) ?? null;
    },

    async getOrganizationBySlug(slug) {
      return (await readData()).organizations.find((o) => o.slug === slug) ?? null;
    },

    async createProfile(input) {
      return withLock(async () => {
        const data = await readData();
        const email = input.email.toLowerCase();
        if (data.profiles.some((p) => p.email.toLowerCase() === email)) {
          throw new Error(`Profile email already exists: ${input.email}`);
        }
        if (
          input.legacy_staff_user_id &&
          data.profiles.some((p) => p.legacy_staff_user_id === input.legacy_staff_user_id)
        ) {
          throw new Error(`Profile already exists for staff user: ${input.legacy_staff_user_id}`);
        }
        const record: ProfileRecord = {
          id: randomUUID(),
          auth_user_id: input.auth_user_id ?? null,
          legacy_staff_user_id: input.legacy_staff_user_id ?? null,
          first_name: input.first_name,
          last_name: input.last_name,
          email: input.email,
          phone: input.phone ?? null,
          avatar_url: null,
          status: input.status ?? "active",
          created_at: nowIso(),
          updated_at: nowIso(),
        };
        data.profiles.push(record);
        await writeData(data);
        return record;
      });
    },

    async getProfileById(id) {
      return (await readData()).profiles.find((p) => p.id === id) ?? null;
    },

    async getProfileByLegacyStaffUserId(staffUserId) {
      return (
        (await readData()).profiles.find((p) => p.legacy_staff_user_id === staffUserId) ?? null
      );
    },

    async getProfileByEmail(email) {
      const target = email.toLowerCase();
      return (await readData()).profiles.find((p) => p.email.toLowerCase() === target) ?? null;
    },

    async listProfiles() {
      return (await readData()).profiles;
    },

    async createMembership(input) {
      return withLock(async () => {
        const data = await readData();
        if (
          data.organization_memberships.some(
            (m) =>
              m.organization_id === input.organization_id && m.profile_id === input.profile_id,
          )
        ) {
          throw new Error(
            `Membership already exists: org ${input.organization_id} / profile ${input.profile_id}`,
          );
        }
        const record: OrganizationMembershipRecord = {
          id: randomUUID(),
          organization_id: input.organization_id,
          profile_id: input.profile_id,
          role: input.role,
          status: input.status ?? "active",
          permissions: input.permissions ?? {},
          created_at: nowIso(),
          updated_at: nowIso(),
        };
        data.organization_memberships.push(record);
        await writeData(data);
        return record;
      });
    },

    async getMembership(organizationId, profileId) {
      return (
        (await readData()).organization_memberships.find(
          (m) => m.organization_id === organizationId && m.profile_id === profileId,
        ) ?? null
      );
    },

    async listMembershipsForProfile(profileId) {
      return (await readData()).organization_memberships.filter(
        (m) => m.profile_id === profileId,
      );
    },

    async listMembershipsForOrganization(organizationId) {
      return (await readData()).organization_memberships.filter(
        (m) => m.organization_id === organizationId,
      );
    },

    async createClient(input) {
      return withLock(async () => {
        const data = await readData();
        if (
          input.source_lead_id &&
          data.clients.some((c) => c.source_lead_id === input.source_lead_id)
        ) {
          throw new Error(`Client already exists for lead: ${input.source_lead_id}`);
        }
        const record: ClientRecord = {
          id: randomUUID(),
          organization_id: input.organization_id,
          profile_id: null,
          source_lead_id: input.source_lead_id ?? null,
          first_name: input.first_name,
          last_name: input.last_name,
          email: input.email ?? null,
          phone: input.phone ?? null,
          state: input.state ?? null,
          status: input.status ?? "prospect",
          source_summary: input.source_summary ?? null,
          created_at: nowIso(),
          updated_at: nowIso(),
        };
        data.clients.push(record);
        await writeData(data);
        return record;
      });
    },

    async getClientById(id) {
      return (await readData()).clients.find((c) => c.id === id) ?? null;
    },

    async getClientBySourceLeadId(leadId) {
      return (await readData()).clients.find((c) => c.source_lead_id === leadId) ?? null;
    },

    async updateClient(id, patch) {
      return withLock(async () => {
        const data = await readData();
        const record = data.clients.find((c) => c.id === id);
        if (!record) throw new Error(`Client not found: ${id}`);
        Object.assign(record, patch, { updated_at: nowIso() });
        await writeData(data);
        return record;
      });
    },

    async listClients(organizationId) {
      return (await readData()).clients.filter((c) => c.organization_id === organizationId);
    },

    async findClientsByEmail(organizationId, email) {
      const target = email.toLowerCase();
      return (await readData()).clients.filter(
        (c) => c.organization_id === organizationId && c.email?.toLowerCase() === target,
      );
    },

    async createOpportunity(input) {
      return withLock(async () => {
        const data = await readData();
        if (
          input.source_lead_id &&
          data.opportunities.some((o) => o.source_lead_id === input.source_lead_id)
        ) {
          throw new Error(`Opportunity already exists for lead: ${input.source_lead_id}`);
        }
        const record: OpportunityRecord = {
          id: randomUUID(),
          organization_id: input.organization_id,
          client_id: input.client_id,
          brand_id: input.brand_id,
          source_lead_id: input.source_lead_id ?? null,
          assigned_advisor_profile_id: input.assigned_advisor_profile_id ?? null,
          assigned_advisor_membership_id: input.assigned_advisor_membership_id ?? null,
          stage: input.stage ?? "NEW_LEAD",
          status: input.status ?? "open",
          qualification_score: input.qualification_score ?? null,
          qualification_result: input.qualification_result ?? null,
          qualification_reasons: input.qualification_reasons ?? null,
          priority: input.priority ?? "normal",
          opened_at: input.opened_at ?? nowIso(),
          last_activity_at: input.last_activity_at ?? null,
          closed_at: null,
          closed_reason: null,
          outcome: null,
          metadata: input.metadata ?? {},
          created_at: nowIso(),
          updated_at: nowIso(),
        };
        data.opportunities.push(record);
        await writeData(data);
        return record;
      });
    },

    async getOpportunityById(id) {
      return (await readData()).opportunities.find((o) => o.id === id) ?? null;
    },

    async getOpportunityBySourceLeadId(leadId) {
      return (await readData()).opportunities.find((o) => o.source_lead_id === leadId) ?? null;
    },

    async updateOpportunity(id, patch) {
      return withLock(async () => {
        const data = await readData();
        const record = data.opportunities.find((o) => o.id === id);
        if (!record) throw new Error(`Opportunity not found: ${id}`);
        Object.assign(record, patch, { updated_at: nowIso() });
        await writeData(data);
        return record;
      });
    },

    async listOpportunitiesForClient(clientId) {
      return (await readData()).opportunities
        .filter((o) => o.client_id === clientId)
        .sort((a, b) => a.created_at.localeCompare(b.created_at));
    },

    async listOpportunities(organizationId) {
      return (await readData()).opportunities.filter(
        (o) => o.organization_id === organizationId,
      );
    },

    async createOpportunityAssignment(input) {
      return withLock(async () => {
        const data = await readData();
        if (
          data.opportunity_assignments.some(
            (a) =>
              a.opportunity_id === input.opportunity_id &&
              a.membership_id === input.membership_id &&
              a.assignment_role === input.assignment_role &&
              a.unassigned_at === null,
          )
        ) {
          throw new Error(
            `Active assignment already exists: ${input.opportunity_id} / ${input.membership_id} / ${input.assignment_role}`,
          );
        }
        const record: OpportunityAssignmentRecord = {
          id: randomUUID(),
          opportunity_id: input.opportunity_id,
          membership_id: input.membership_id,
          assignment_role: input.assignment_role,
          is_primary: input.is_primary ?? false,
          assigned_at: nowIso(),
          unassigned_at: null,
          created_at: nowIso(),
        };
        data.opportunity_assignments.push(record);
        await writeData(data);
        return record;
      });
    },

    async listAssignmentsForOpportunity(opportunityId) {
      return (await readData()).opportunity_assignments
        .filter((a) => a.opportunity_id === opportunityId)
        .sort((a, b) => a.assigned_at.localeCompare(b.assigned_at));
    },

    async upsertExternalMapping(input) {
      return withLock(async () => {
        const data = await readData();
        const existing = data.external_record_mappings.find(
          (m) =>
            m.organization_id === input.organization_id &&
            m.provider === input.provider &&
            m.entity_type === input.entity_type &&
            m.external_id === input.external_id,
        );
        if (existing) {
          Object.assign(existing, {
            internal_entity_id: input.internal_entity_id,
            external_parent_id: input.external_parent_id ?? existing.external_parent_id,
            metadata: input.metadata ?? existing.metadata,
            last_synced_at: nowIso(),
            updated_at: nowIso(),
          });
          await writeData(data);
          return existing;
        }
        // Mirrors external_record_mappings_internal_unique: one mapping per
        // internal entity per org + provider + entity type.
        if (
          data.external_record_mappings.some(
            (m) =>
              m.organization_id === input.organization_id &&
              m.provider === input.provider &&
              m.entity_type === input.entity_type &&
              m.internal_entity_id === input.internal_entity_id,
          )
        ) {
          throw new Error(
            `A ${input.provider} ${input.entity_type} mapping already exists for entity ${input.internal_entity_id}`,
          );
        }
        const record: ExternalRecordMappingRecord = {
          id: randomUUID(),
          organization_id: input.organization_id,
          provider: input.provider,
          entity_type: input.entity_type,
          internal_entity_id: input.internal_entity_id,
          external_id: input.external_id,
          external_parent_id: input.external_parent_id ?? null,
          metadata: input.metadata ?? {},
          last_synced_at: nowIso(),
          created_at: nowIso(),
          updated_at: nowIso(),
        };
        data.external_record_mappings.push(record);
        await writeData(data);
        return record;
      });
    },

    async getExternalMapping(organizationId, provider, entityType, externalId) {
      return (
        (await readData()).external_record_mappings.find(
          (m) =>
            m.organization_id === organizationId &&
            m.provider === provider &&
            m.entity_type === entityType &&
            m.external_id === externalId,
        ) ?? null
      );
    },

    async listMappingsForEntity(internalEntityId) {
      return (await readData()).external_record_mappings.filter(
        (m) => m.internal_entity_id === internalEntityId,
      );
    },

    async createIntegrationConnection(input) {
      return withLock(async () => {
        const data = await readData();
        const record: IntegrationConnectionRecord = {
          id: randomUUID(),
          organization_id: input.organization_id,
          brand_id: input.brand_id ?? null,
          provider: input.provider,
          name: input.name,
          status: input.status ?? "active",
          config: input.config ?? {},
          secret_reference: input.secret_reference ?? null,
          last_success_at: null,
          last_error_at: null,
          last_error: null,
          created_at: nowIso(),
          updated_at: nowIso(),
        };
        data.integration_connections.push(record);
        await writeData(data);
        return record;
      });
    },

    async listIntegrationConnections(organizationId) {
      return (await readData()).integration_connections.filter(
        (c) => c.organization_id === organizationId,
      );
    },

    async insertActivityEvent(input) {
      return withLock(async () => {
        const data = await readData();
        if (
          input.external_event_id &&
          data.activity_events.some(
            (e) =>
              e.organization_id === input.organization_id &&
              e.event_source === input.event_source &&
              e.external_event_id === input.external_event_id,
          )
        ) {
          return null; // duplicate provider event
        }
        const record: ActivityEventRecord = {
          id: randomUUID(),
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
          legacy_portal_event_id: null,
          occurred_at: input.occurred_at ?? nowIso(),
          created_at: nowIso(),
        };
        data.activity_events.push(record);
        await writeData(data);
        return record;
      });
    },

    async listActivityForOpportunity(opportunityId) {
      return (await readData()).activity_events
        .filter((e) => e.opportunity_id === opportunityId)
        .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
    },

    async listActivityForClient(clientId) {
      return (await readData()).activity_events
        .filter((e) => e.client_id === clientId)
        .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
    },

    async hasActivityExternalEvent(organizationId, eventSource, externalEventId) {
      return (await readData()).activity_events.some(
        (e) =>
          e.organization_id === organizationId &&
          e.event_source === eventSource &&
          e.external_event_id === externalEventId,
      );
    },

    async createFddWorkflow(input) {
      return withLock(async () => {
        const data = await readData();
        if (data.opportunity_fdd_workflows.some((w) => w.opportunity_id === input.opportunity_id)) {
          throw new Error(`FDD workflow already exists for opportunity: ${input.opportunity_id}`);
        }
        const record: OpportunityFddWorkflowRecord = {
          id: randomUUID(),
          organization_id: input.organization_id,
          client_id: input.client_id,
          opportunity_id: input.opportunity_id,
          brand_id: input.brand_id,
          status: input.status ?? "not_requested",
          requested_at: null,
          sent_at: null,
          delivered_at: null,
          received_at: null,
          eligible_at: null,
          provider: null,
          provider_envelope_id: null,
          external_workflow_id: null,
          request_source: null,
          last_error: null,
          retry_count: 0,
          created_at: nowIso(),
          updated_at: nowIso(),
        };
        data.opportunity_fdd_workflows.push(record);
        await writeData(data);
        return record;
      });
    },

    async getFddWorkflowByOpportunityId(opportunityId) {
      return (
        (await readData()).opportunity_fdd_workflows.find(
          (w) => w.opportunity_id === opportunityId,
        ) ?? null
      );
    },

    async updateFddWorkflow(id, patch) {
      return withLock(async () => {
        const data = await readData();
        const record = data.opportunity_fdd_workflows.find((w) => w.id === id);
        if (!record) throw new Error(`FDD workflow not found: ${id}`);
        Object.assign(record, patch, { updated_at: nowIso() });
        await writeData(data);
        return record;
      });
    },

    async listFddWorkflows(organizationId) {
      return (await readData()).opportunity_fdd_workflows.filter(
        (w) => w.organization_id === organizationId,
      );
    },
    // -----------------------------------------------------------------------
    // Territory Advisor
    // -----------------------------------------------------------------------

    async getBrandBySlug(slug: string): Promise<FranchiseBrandRecord | null> {
      return (await readData()).franchise_brands.find((b) => b.slug === slug) ?? null;
    },

    async getBrandById(id: string): Promise<FranchiseBrandRecord | null> {
      return (await readData()).franchise_brands.find((b) => b.id === id) ?? null;
    },

    async listBrands(): Promise<FranchiseBrandRecord[]> {
      return (await readData()).franchise_brands;
    },

    async createBrand(input: CreateFranchiseBrandInput): Promise<FranchiseBrandRecord> {
      return withLock(async () => {
        const data = await readData();
        if (data.franchise_brands.some((b) => b.slug === input.slug)) {
          throw new Error(`Brand already exists: ${input.slug}`);
        }
        const record: FranchiseBrandRecord = {
          id: randomUUID(),
          slug: input.slug,
          name: input.name,
          active: input.active ?? true,
          default_radius_miles: input.default_radius_miles ?? 10,
          organization_id: input.organization_id ?? null,
          created_at: nowIso(),
          updated_at: nowIso(),
        };
        data.franchise_brands.push(record);
        await writeData(data);
        return record;
      });
    },

    async getStateEligibility(
      brandId: string,
      stateCode: string,
    ): Promise<BrandStateEligibilityRecord | null> {
      const data = await readData();
      return (
        data.brand_state_eligibility.find(
          (r) => r.brand_id === brandId && r.state_code === stateCode.toUpperCase(),
        ) ?? null
      );
    },

    async listStateEligibility(brandId: string): Promise<BrandStateEligibilityRecord[]> {
      return (await readData()).brand_state_eligibility.filter((r) => r.brand_id === brandId);
    },

    async upsertStateEligibility(
      input: UpsertStateEligibilityInput,
    ): Promise<BrandStateEligibilityRecord> {
      return withLock(async () => {
        const data = await readData();
        const stateCode = input.state_code.toUpperCase();
        let record = data.brand_state_eligibility.find(
          (r) => r.brand_id === input.brand_id && r.state_code === stateCode,
        );
        if (!record) {
          record = {
            id: randomUUID(),
            brand_id: input.brand_id,
            state_code: stateCode,
            status: input.status,
            effective_date: input.effective_date ?? null,
            expiration_date: input.expiration_date ?? null,
            notes_internal: input.notes_internal ?? null,
            created_at: nowIso(),
            updated_at: nowIso(),
          };
          data.brand_state_eligibility.push(record);
        } else {
          Object.assign(record, {
            status: input.status,
            effective_date: input.effective_date ?? record.effective_date,
            expiration_date: input.expiration_date ?? record.expiration_date,
            notes_internal: input.notes_internal ?? record.notes_internal,
            updated_at: nowIso(),
          });
        }
        await writeData(data);
        return record;
      });
    },

    async listTerritoryDefinitions(brandId: string): Promise<TerritoryDefinitionRecord[]> {
      return (await readData()).territory_definitions.filter((t) => t.brand_id === brandId);
    },

    async getTerritoryDefinition(id: string): Promise<TerritoryDefinitionRecord | null> {
      return (await readData()).territory_definitions.find((t) => t.id === id) ?? null;
    },

    async createTerritoryDefinition(
      input: CreateTerritoryDefinitionInput,
    ): Promise<TerritoryDefinitionRecord> {
      return withLock(async () => {
        const data = await readData();
        const record: TerritoryDefinitionRecord = {
          id: randomUUID(),
          brand_id: input.brand_id,
          territory_name: input.territory_name,
          territory_code: input.territory_code ?? null,
          definition_type: input.definition_type,
          status: input.status ?? "available",
          center_latitude: input.center_latitude ?? null,
          center_longitude: input.center_longitude ?? null,
          radius_miles: input.radius_miles ?? null,
          public_display_level: input.public_display_level ?? "hidden",
          internal_notes: input.internal_notes ?? null,
          awarded_at: input.awarded_at ?? null,
          reserved_until: input.reserved_until ?? null,
          created_at: nowIso(),
          updated_at: nowIso(),
        };
        data.territory_definitions.push(record);
        await writeData(data);
        return record;
      });
    },

    async updateTerritoryDefinition(
      id: string,
      patch: TerritoryDefinitionPatch,
    ): Promise<TerritoryDefinitionRecord> {
      return withLock(async () => {
        const data = await readData();
        const record = data.territory_definitions.find((t) => t.id === id);
        if (!record) throw new Error(`Territory definition not found: ${id}`);
        Object.assign(record, patch, { updated_at: nowIso() });
        await writeData(data);
        return record;
      });
    },

    async listZipCodesForTerritory(territoryDefinitionId: string): Promise<TerritoryZipCodeRecord[]> {
      return (await readData()).territory_zip_codes.filter(
        (z) => z.territory_definition_id === territoryDefinitionId,
      );
    },

    async addTerritoryZipCodes(
      territoryDefinitionId: string,
      zipCodes: string[],
    ): Promise<TerritoryZipCodeRecord[]> {
      return withLock(async () => {
        const data = await readData();
        const existing = new Set(
          data.territory_zip_codes
            .filter((z) => z.territory_definition_id === territoryDefinitionId)
            .map((z) => z.zip_code),
        );
        const added: TerritoryZipCodeRecord[] = [];
        for (const raw of zipCodes) {
          const zip = raw.trim();
          if (!zip || existing.has(zip)) continue;
          const record: TerritoryZipCodeRecord = {
            id: randomUUID(),
            territory_definition_id: territoryDefinitionId,
            zip_code: zip,
            created_at: nowIso(),
          };
          data.territory_zip_codes.push(record);
          added.push(record);
          existing.add(zip);
        }
        await writeData(data);
        return added;
      });
    },

    async removeTerritoryZipCode(id: string): Promise<void> {
      await withLock(async () => {
        const data = await readData();
        data.territory_zip_codes = data.territory_zip_codes.filter((z) => z.id !== id);
        await writeData(data);
      });
    },

    async getZipCodeReference(zipCode: string): Promise<ZipCodeReferenceRecord | null> {
      return (await readData()).zip_code_reference.find((z) => z.zip_code === zipCode) ?? null;
    },

    async listZipCodeReferences(): Promise<ZipCodeReferenceRecord[]> {
      return (await readData()).zip_code_reference;
    },

    async upsertZipCodeReferences(rows: UpsertZipCodeReferenceInput[]): Promise<void> {
      await withLock(async () => {
        const data = await readData();
        const demographicDefaults = {
          population: null,
          households: null,
          median_household_income: null,
          population_growth_pct: null,
          demographics_source: null,
          demographics_vintage: null,
        };
        for (const row of rows) {
          const index = data.zip_code_reference.findIndex((z) => z.zip_code === row.zip_code);
          if (index === -1) {
            data.zip_code_reference.push({ ...demographicDefaults, ...row });
          } else {
            // Merge: omitted demographic keys keep their existing values.
            data.zip_code_reference[index] = { ...data.zip_code_reference[index], ...row };
          }
        }
        await writeData(data);
      });
    },

    async upsertZipGeographies(rows): Promise<void> {
      await withLock(async () => {
        const data = await readData();
        for (const row of rows) {
          const record: ZipGeographyRecord = {
            zip_code: row.zip_code,
            state_code: row.state_code,
            latitude: row.latitude,
            longitude: row.longitude,
            geojson: row.geojson,
            geometry_source: row.geometry_source,
            geometry_version: row.geometry_version,
          };
          const index = data.zip_code_geographies.findIndex((g) => g.zip_code === row.zip_code);
          if (index === -1) data.zip_code_geographies.push(record);
          else data.zip_code_geographies[index] = record;
        }
        await writeData(data);
      });
    },

    async listZipGeographies(zipCodes): Promise<ZipGeographyRecord[]> {
      const wanted = new Set(zipCodes);
      return (await readData()).zip_code_geographies.filter(
        (g) => wanted.has(g.zip_code) && g.geojson !== null,
      );
    },

    async hasZipGeographiesForState(stateCode: string): Promise<boolean> {
      return (await readData()).zip_code_geographies.some(
        (g) => g.state_code === stateCode && g.geojson !== null,
      );
    },

    async createTerritorySearch(input: CreateTerritorySearchInput): Promise<TerritorySearchRecord> {
      return withLock(async () => {
        const data = await readData();
        const record: TerritorySearchRecord = {
          id: randomUUID(),
          lead_id: input.lead_id,
          brand_id: input.brand_id,
          raw_query: input.raw_query,
          normalized_location: input.normalized_location ?? null,
          latitude: input.latitude ?? null,
          longitude: input.longitude ?? null,
          city: input.city ?? null,
          state_code: input.state_code ?? null,
          zip_code: input.zip_code ?? null,
          radius_miles: input.radius_miles ?? null,
          result_status: input.result_status,
          result_summary: input.result_summary ?? null,
          matched_territory_count: input.matched_territory_count ?? 0,
          request_manual_review: input.request_manual_review ?? false,
          created_at: nowIso(),
          organization_id: input.organization_id ?? null,
          client_id: input.client_id ?? null,
          opportunity_id: input.opportunity_id ?? null,
        };
        data.territory_searches.push(record);
        await writeData(data);
        return record;
      });
    },

    async getTerritorySearch(id: string): Promise<TerritorySearchRecord | null> {
      return (await readData()).territory_searches.find((s) => s.id === id) ?? null;
    },

    async listTerritorySearchesForLead(leadId: string): Promise<TerritorySearchRecord[]> {
      return (await readData()).territory_searches
        .filter((s) => s.lead_id === leadId)
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
    },

    async listTerritorySearches(): Promise<TerritorySearchRecord[]> {
      return (await readData()).territory_searches.sort((a, b) =>
        b.created_at.localeCompare(a.created_at),
      );
    },

    async createTerritoryReviewRequest(
      input: CreateTerritoryReviewRequestInput,
    ): Promise<TerritoryReviewRequestRecord> {
      return withLock(async () => {
        const data = await readData();
        const record: TerritoryReviewRequestRecord = {
          id: randomUUID(),
          lead_id: input.lead_id,
          brand_id: input.brand_id,
          territory_search_id: input.territory_search_id ?? null,
          status: "new",
          prospect_message: input.prospect_message ?? null,
          assigned_to: null,
          reviewed_at: null,
          internal_notes: null,
          created_at: nowIso(),
          updated_at: nowIso(),
          organization_id: input.organization_id ?? null,
          client_id: input.client_id ?? null,
          opportunity_id: input.opportunity_id ?? null,
        };
        data.territory_review_requests.push(record);
        await writeData(data);
        return record;
      });
    },

    async getTerritoryReviewRequest(id: string): Promise<TerritoryReviewRequestRecord | null> {
      return (await readData()).territory_review_requests.find((r) => r.id === id) ?? null;
    },

    async listTerritoryReviewRequestsForLead(leadId: string): Promise<TerritoryReviewRequestRecord[]> {
      return (await readData()).territory_review_requests
        .filter((r) => r.lead_id === leadId)
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
    },

    async listTerritoryReviewRequests(): Promise<TerritoryReviewRequestRecord[]> {
      return (await readData()).territory_review_requests.sort((a, b) =>
        b.created_at.localeCompare(a.created_at),
      );
    },

    async updateTerritoryReviewRequest(
      id: string,
      patch: TerritoryReviewRequestPatch,
    ): Promise<TerritoryReviewRequestRecord> {
      return withLock(async () => {
        const data = await readData();
        const record = data.territory_review_requests.find((r) => r.id === id);
        if (!record) throw new Error(`Territory review request not found: ${id}`);
        Object.assign(record, patch, { updated_at: nowIso() });
        await writeData(data);
        return record;
      });
    },

    async createCensusImportJob(input: CreateCensusImportJobInput): Promise<CensusImportJobRecord> {
      return withLock(async () => {
        const data = await readData();
        const now = nowIso();
        const record: CensusImportJobRecord = {
          id: randomUUID(),
          status: "running",
          trigger: input.trigger,
          vintage: input.vintage,
          states_total: input.states_total,
          states_done: 0,
          states_failed: 0,
          last_error: null,
          started_at: now,
          finished_at: null,
          updated_at: now,
        };
        data.census_import_jobs.push(record);
        await writeData(data);
        return record;
      });
    },

    async updateCensusImportJob(id: string, patch: CensusImportJobPatch): Promise<CensusImportJobRecord> {
      return withLock(async () => {
        const data = await readData();
        const record = data.census_import_jobs.find((j) => j.id === id);
        if (!record) throw new Error(`Census import job not found: ${id}`);
        Object.assign(record, patch, { updated_at: nowIso() });
        await writeData(data);
        return record;
      });
    },

    async getCensusImportJob(id: string): Promise<CensusImportJobRecord | null> {
      return (await readData()).census_import_jobs.find((j) => j.id === id) ?? null;
    },

    async getActiveCensusImportJob(): Promise<CensusImportJobRecord | null> {
      const jobs = (await readData()).census_import_jobs
        .filter((j) => j.status === "running")
        .sort((a, b) => b.started_at.localeCompare(a.started_at));
      return jobs[0] ?? null;
    },

    async listCensusImportJobs(limit: number): Promise<CensusImportJobRecord[]> {
      return (await readData()).census_import_jobs
        .slice()
        .sort((a, b) => b.started_at.localeCompare(a.started_at))
        .slice(0, limit);
    },

    async recordCensusRawImport(input: RecordCensusRawImportInput): Promise<void> {
      await withLock(async () => {
        const data = await readData();
        const existing = data.census_acs_raw.find(
          (r) => r.vintage === input.vintage && r.state_code === input.state_code,
        );
        const fetched_at = nowIso();
        if (existing) {
          Object.assign(existing, {
            job_id: input.job_id,
            variables: input.variables,
            payload: input.payload,
            fetched_at,
          });
        } else {
          data.census_acs_raw.push({
            id: randomUUID(),
            job_id: input.job_id,
            vintage: input.vintage,
            state_code: input.state_code,
            variables: input.variables,
            payload: input.payload,
            fetched_at,
          });
        }
        await writeData(data);
      });
    },

    async countCensusAcsRaw(): Promise<number> {
      return (await readData()).census_acs_raw.length;
    },

    // -------------------------------------------------------------------
    // Tracking & Attribution
    // -------------------------------------------------------------------
    async getTrackingSettings(): Promise<TrackingSettingsRecord> {
      return withLock(async () => {
        const data = await readData();
        let settings = data.tracking_settings.find((s) => s.brand_id === null);
        if (!settings) {
          settings = {
            id: randomUUID(),
            brand_id: null,
            gtm_enabled: false,
            gtm_container_id: null,
            meta_enabled: false,
            meta_browser_mode: "gtm",
            meta_pixel_id: null,
            meta_capi_enabled: false,
            meta_capi_access_token_ciphertext: null,
            meta_test_event_code: null,
            consent_required: false,
            marketing_tracking_default: "denied",
            event_overrides: {},
            last_gtm_test_at: null,
            last_meta_browser_test_at: null,
            last_meta_capi_success_at: null,
            last_meta_capi_failure_at: null,
            last_meta_capi_error: null,
            created_at: nowIso(),
            updated_at: nowIso(),
          };
          data.tracking_settings.push(settings);
          await writeData(data);
        }
        return settings;
      });
    },

    async updateTrackingSettings(id: string, patch: TrackingSettingsPatch): Promise<TrackingSettingsRecord> {
      return withLock(async () => {
        const data = await readData();
        const settings = data.tracking_settings.find((s) => s.id === id);
        if (!settings) throw new Error(`Tracking settings not found: ${id}`);
        Object.assign(settings, patch, { updated_at: nowIso() });
        await writeData(data);
        return settings;
      });
    },

    async insertTrackingDelivery(input: CreateTrackingDeliveryInput): Promise<TrackingDeliveryRecord> {
      return withLock(async () => {
        const data = await readData();
        const record: TrackingDeliveryRecord = {
          id: randomUUID(),
          portal_event_id: input.portal_event_id ?? null,
          lead_id: input.lead_id ?? null,
          provider: input.provider,
          event_name: input.event_name,
          external_event_name: input.external_event_name ?? null,
          event_id: input.event_id,
          delivery_mode: input.delivery_mode,
          status: input.status,
          attempt_count: input.attempt_count ?? 0,
          next_attempt_at: input.next_attempt_at ?? null,
          response_code: input.response_code ?? null,
          provider_response: input.provider_response ?? null,
          sent_at: input.sent_at ?? null,
          failed_at: input.failed_at ?? null,
          created_at: nowIso(),
        };
        data.tracking_deliveries.push(record);
        await writeData(data);
        return record;
      });
    },

    async updateTrackingDelivery(id: string, patch: TrackingDeliveryPatch): Promise<TrackingDeliveryRecord> {
      return withLock(async () => {
        const data = await readData();
        const record = data.tracking_deliveries.find((d) => d.id === id);
        if (!record) throw new Error(`Tracking delivery not found: ${id}`);
        Object.assign(record, patch);
        await writeData(data);
        return record;
      });
    },

    async listTrackingDeliveries(filter: ListTrackingDeliveriesFilter = {}): Promise<TrackingDeliveryRecord[]> {
      const data = await readData();
      let rows = data.tracking_deliveries.slice().sort((a, b) => b.created_at.localeCompare(a.created_at));
      if (filter.leadId) rows = rows.filter((d) => d.lead_id === filter.leadId);
      if (filter.status) rows = rows.filter((d) => d.status === filter.status);
      if (filter.provider) rows = rows.filter((d) => d.provider === filter.provider);
      return rows.slice(0, filter.limit ?? 200);
    },

    async listDueTrackingDeliveries(nowIsoValue: string): Promise<TrackingDeliveryRecord[]> {
      const data = await readData();
      return data.tracking_deliveries
        .filter(
          (d) =>
            d.status === "failed" &&
            d.attempt_count < 3 &&
            d.next_attempt_at !== null &&
            d.next_attempt_at <= nowIsoValue,
        )
        .sort((a, b) => (a.next_attempt_at ?? "").localeCompare(b.next_attempt_at ?? ""))
        .slice(0, 100);
    },

    async insertConsent(input: CreateConsentInput): Promise<ConsentRecord> {
      return withLock(async () => {
        const data = await readData();
        const record: ConsentRecord = {
          id: randomUUID(),
          lead_id: input.lead_id ?? null,
          portal_token: input.portal_token ?? null,
          necessary: input.necessary ?? true,
          analytics: input.analytics,
          marketing: input.marketing,
          consent_version: input.consent_version,
          ip_address: input.ip_address ?? null,
          user_agent: input.user_agent ?? null,
          created_at: nowIso(),
        };
        data.portal_consent.push(record);
        await writeData(data);
        return record;
      });
    },

    async getLatestConsent(args: { leadId?: string; portalToken?: string }): Promise<ConsentRecord | null> {
      const data = await readData();
      const rows = data.portal_consent
        .filter((c) => (args.leadId ? c.lead_id === args.leadId : c.portal_token === args.portalToken))
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
      return rows[0] ?? null;
    },
  };
}
