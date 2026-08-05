import { effectiveFddStatus } from "@/lib/fdd/status";
import type { AppointmentRecord } from "@/types/advisor";
import type { LeadRecord } from "@/types/lead";
import type { VideoProgressRecord } from "@/types/portal";

/**
 * Transparent, rule-based follow-up flags. No workflow engine, no scoring —
 * each rule states its reason so the advisor sees exactly why an investor
 * is flagged. Thresholds are configurable here in code.
 */
export const FOLLOW_UP_THRESHOLDS = {
  questionnaireNoConsultHours: 24,
  fddUnacknowledgedHours: 48,
  consultationNoUpdateHours: 24,
  engagedNoQuestionnaireHours: 48,
  /** "High video engagement" means at least this percent watched. */
  highEngagementPercent: 50,
} as const;

export interface FollowUpContext {
  lead: LeadRecord;
  appointments: AppointmentRecord[];
  video: VideoProgressRecord | null;
  now?: Date;
}

export interface FollowUpResult {
  needed: boolean;
  reasons: string[];
}

function hoursSince(iso: string, now: Date): number {
  return (now.getTime() - new Date(iso).getTime()) / 3_600_000;
}

function daysAgoLabel(iso: string, now: Date): string {
  const hours = hoursSince(iso, now);
  if (hours < 24) return `${Math.max(1, Math.floor(hours))} hour${Math.floor(hours) === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export function evaluateFollowUp(context: FollowUpContext): FollowUpResult {
  const { lead, appointments, video } = context;
  const now = context.now ?? new Date();
  const t = FOLLOW_UP_THRESHOLDS;
  const reasons: string[] = [];

  const activeAppointment = appointments.find(
    (a) => a.status === "SCHEDULED" || a.status === "RESCHEDULED",
  );
  const completedAppointment = appointments.find((a) => a.status === "COMPLETED");
  const hasBooking = Boolean(activeAppointment) || Boolean(lead.booked_at);

  // Questionnaire completed, no consultation booked.
  if (
    lead.questionnaire_completed_at &&
    !hasBooking &&
    hoursSince(lead.questionnaire_completed_at, now) >= t.questionnaireNoConsultHours
  ) {
    reasons.push(
      `Questionnaire completed ${daysAgoLabel(lead.questionnaire_completed_at, now)}; no consultation booked.`,
    );
  }

  // FDD sent (or delivered), not yet received/acknowledged by the prospect.
  const fddStatus = effectiveFddStatus(lead, now);
  const fddAwaitingReceipt = fddStatus === "fdd_sent" || fddStatus === "fdd_delivered";
  if (
    lead.fdd_sent_at &&
    fddAwaitingReceipt &&
    hoursSince(lead.fdd_sent_at, now) >= t.fddUnacknowledgedHours
  ) {
    reasons.push(`FDD sent ${daysAgoLabel(lead.fdd_sent_at, now)}; not yet acknowledged.`);
  }

  // Consultation completed but the pipeline stage hasn't moved since.
  if (
    completedAppointment &&
    lead.current_stage === "CONSULTATION_COMPLETED" &&
    hoursSince(completedAppointment.updated_at, now) >= t.consultationNoUpdateHours
  ) {
    reasons.push(
      `Consultation completed ${daysAgoLabel(completedAppointment.updated_at, now)}; no stage update since.`,
    );
  }

  // High video engagement without a questionnaire.
  if (
    !lead.questionnaire_completed_at &&
    video &&
    video.highest_percent_watched >= t.highEngagementPercent &&
    video.last_event_at &&
    hoursSince(video.last_event_at, now) >= t.engagedNoQuestionnaireHours
  ) {
    reasons.push(
      `Watched ${Math.round(video.highest_percent_watched)}% of the video ${daysAgoLabel(video.last_event_at, now)}; questionnaire not completed.`,
    );
  }

  // Appointment cancelled and never rescheduled.
  const cancelled = appointments.find((a) => a.status === "CANCELLED");
  if (cancelled && !activeAppointment && !completedAppointment) {
    reasons.push(`Consultation cancelled ${daysAgoLabel(cancelled.updated_at, now)}; not rescheduled.`);
  }

  return { needed: reasons.length > 0, reasons };
}
