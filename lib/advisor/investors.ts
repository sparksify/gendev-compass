import { getStore } from "@/lib/store";
import { effectiveFddStatus } from "@/lib/fdd/status";
import { visibleLeads } from "./access";
import { evaluateFollowUp, type FollowUpResult } from "./followUp";
import { suggestNextAction } from "./nextAction";
import type { AppointmentRecord, StaffUserRecord } from "@/types/advisor";
import type { FddStatus } from "@/types/fdd";
import type { LeadRecord } from "@/types/lead";
import type { QuestionnaireRecord } from "@/types/questionnaire";
import type { VideoProgressRecord } from "@/types/portal";

/**
 * One joined row per investor — everything the dashboard and list pages
 * need. Built in application code from full-table reads: pilot scale is a
 * single brand with a small lead volume, and this keeps the Supabase and
 * dev stores behaviorally identical.
 *
 * FDD state lives directly on the lead (lib/fdd) — the single source of
 * truth for the document workflow, so the advisor view never diverges from
 * the GoHighLevel-integrated system that actually sends it.
 */
export interface InvestorRow {
  lead: LeadRecord;
  questionnaire: QuestionnaireRecord | null;
  video: VideoProgressRecord | null;
  appointments: AppointmentRecord[];
  activeAppointment: AppointmentRecord | null;
  fddStatus: FddStatus;
  advisor: StaffUserRecord | null;
  followUp: FollowUpResult;
  nextAction: string;
  lastActivityAt: string;
}

export async function loadInvestorRows(user: StaffUserRecord): Promise<InvestorRow[]> {
  const store = getStore();
  const [leads, questionnaires, videos, appointments, staff] = await Promise.all([
    store.listLeads(),
    store.listQuestionnaires(),
    store.listVideoProgress(),
    store.listAppointments(),
    store.listStaffUsers(),
  ]);

  const questionnaireByLead = new Map(questionnaires.map((q) => [q.lead_id, q]));
  const videoByLead = new Map(videos.map((v) => [v.lead_id, v]));
  const staffById = new Map(staff.map((s) => [s.id, s]));
  const appointmentsByLead = new Map<string, AppointmentRecord[]>();
  for (const appointment of appointments) {
    const list = appointmentsByLead.get(appointment.lead_id) ?? [];
    list.push(appointment);
    appointmentsByLead.set(appointment.lead_id, list);
  }

  const rows = visibleLeads(user, leads).map((lead): InvestorRow => {
    const leadAppointments = (appointmentsByLead.get(lead.id) ?? []).sort((a, b) =>
      b.created_at.localeCompare(a.created_at),
    );
    const video = videoByLead.get(lead.id) ?? null;
    return {
      lead,
      questionnaire: questionnaireByLead.get(lead.id) ?? null,
      video,
      appointments: leadAppointments,
      activeAppointment:
        leadAppointments.find((a) => a.status === "SCHEDULED" || a.status === "RESCHEDULED") ?? null,
      fddStatus: effectiveFddStatus(lead),
      advisor: lead.assigned_advisor_id ? (staffById.get(lead.assigned_advisor_id) ?? null) : null,
      followUp: evaluateFollowUp({ lead, appointments: leadAppointments, video }),
      nextAction: suggestNextAction(lead, leadAppointments, video),
      lastActivityAt: lead.last_activity_at ?? lead.created_at,
    };
  });

  // Default sort: most recent activity first.
  return rows.sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt));
}

export interface InvestorFilters {
  search?: string;
  stage?: string;
  advisorId?: string;
  state?: string;
  consultation?: "scheduled" | "completed" | "cancelled" | "none";
  fdd?: "requested" | "sent" | "acknowledged" | "none";
  questionnaire?: "completed" | "incomplete";
  activeWithinHours?: number;
  followUpOnly?: boolean;
}

export function filterInvestorRows(
  rows: InvestorRow[],
  filters: InvestorFilters,
  now: Date = new Date(),
): InvestorRow[] {
  return rows.filter((row) => {
    const { lead } = row;

    if (filters.search) {
      const needle = filters.search.trim().toLowerCase();
      const digits = needle.replace(/\D/g, "");
      const haystack = `${lead.first_name} ${lead.last_name} ${lead.email}`.toLowerCase();
      const phoneDigits = (lead.phone ?? "").replace(/\D/g, "");
      const phoneMatch = digits.length >= 3 && phoneDigits.includes(digits);
      if (!haystack.includes(needle) && !phoneMatch) return false;
    }

    if (filters.stage && lead.current_stage !== filters.stage) return false;
    if (filters.advisorId && lead.assigned_advisor_id !== filters.advisorId) return false;
    if (filters.state && (lead.state ?? "").toLowerCase() !== filters.state.toLowerCase()) {
      return false;
    }

    if (filters.consultation) {
      const statuses = row.appointments.map((a) => a.status);
      const matches =
        filters.consultation === "scheduled"
          ? statuses.includes("SCHEDULED") || statuses.includes("RESCHEDULED")
          : filters.consultation === "completed"
            ? statuses.includes("COMPLETED")
            : filters.consultation === "cancelled"
              ? statuses.includes("CANCELLED")
              : row.appointments.length === 0 && !lead.booked_at;
      if (!matches) return false;
    }

    if (filters.fdd) {
      const status = row.fddStatus;
      const matches =
        filters.fdd === "acknowledged"
          ? status === "fdd_received" || status === "waiting_period_active" || status === "eligible_for_agreement"
          : filters.fdd === "sent"
            ? status === "fdd_sent" || status === "fdd_delivered"
            : filters.fdd === "requested"
              ? status === "request_processing" || status === "error_manual_review"
              : status === "not_requested";
      if (!matches) return false;
    }

    if (filters.questionnaire === "completed" && !lead.questionnaire_completed_at) return false;
    if (filters.questionnaire === "incomplete" && lead.questionnaire_completed_at) return false;

    if (filters.activeWithinHours) {
      const cutoff = now.getTime() - filters.activeWithinHours * 3_600_000;
      if (new Date(row.lastActivityAt).getTime() < cutoff) return false;
    }

    if (filters.followUpOnly && !row.followUp.needed) return false;

    return true;
  });
}
