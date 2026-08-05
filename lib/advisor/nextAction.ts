import type { AppointmentRecord, FddRecordRow } from "@/types/advisor";
import type { LeadRecord } from "@/types/lead";
import type { VideoProgressRecord } from "@/types/portal";
import { FOLLOW_UP_THRESHOLDS } from "./followUp";

/**
 * Rule-based suggested next action for the priority list. Deliberately
 * simple and transparent — no scoring, no prediction. Rules are checked in
 * priority order and the first match wins.
 */
export function suggestNextAction(
  lead: LeadRecord,
  appointments: AppointmentRecord[],
  fdd: FddRecordRow | null,
  video: VideoProgressRecord | null,
): string {
  const stage = lead.current_stage;

  if (stage === "NOT_A_FIT" || stage === "CLOSED_INVESTED") return "—";

  const activeAppointment = appointments.find(
    (a) => a.status === "SCHEDULED" || a.status === "RESCHEDULED",
  );
  const cancelled = appointments.find((a) => a.status === "CANCELLED");
  const completed = appointments.find((a) => a.status === "COMPLETED");

  if (fdd?.sent_at && !fdd.acknowledged_at) return "Follow up on FDD";
  if (cancelled && !activeAppointment && !completed) return "Rebook cancelled consultation";
  if (activeAppointment || (lead.booked_at && !completed && stage === "CONSULTATION_SCHEDULED")) {
    return "Prepare for consultation";
  }
  if (stage === "CONSULTATION_COMPLETED") return "Review outcome and update stage";
  if (lead.questionnaire_completed_at && !activeAppointment && !completed && !lead.booked_at) {
    return "Schedule follow-up";
  }
  if (
    !lead.questionnaire_completed_at &&
    video &&
    video.highest_percent_watched >= FOLLOW_UP_THRESHOLDS.highEngagementPercent
  ) {
    return "Encourage questionnaire completion";
  }
  if (stage === "FDD_ACKNOWLEDGED") return "Begin due diligence discussion";
  if (stage === "NEW_LEAD") return "Await portal activity";
  return "Monitor engagement";
}
