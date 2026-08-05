import type { LeadRecord } from "@/types/lead";
import type { QuestionnaireRecord } from "@/types/questionnaire";
import type { PortalRoute, PortalState, VideoProgressRecord } from "@/types/portal";
import { effectiveFddStatus, FDD_STATUS_LABELS } from "@/lib/fdd/status";

/**
 * Derives everything route gating and UI need from the stored records.
 * Routes are controlled by state (spec §20): a prospect always resumes at
 * the furthest step they have legitimately reached.
 */
export function getPortalState(
  lead: LeadRecord,
  videoProgress: VideoProgressRecord | null,
  questionnaire: QuestionnaireRecord | null,
): PortalState {
  const booked = lead.status === "booked" || Boolean(lead.booked_at);
  const reviewRequired = lead.qualification_result === "review_required";
  const qualified = lead.qualification_result === "qualified";
  const questionnaireCompleted = Boolean(questionnaire) || Boolean(lead.questionnaire_completed_at);
  const videoCompleted = Boolean(videoProgress?.completed) || Boolean(lead.video_completed_at);
  const videoStarted = Boolean(videoProgress?.started) || Boolean(lead.video_started_at);
  const videoPercent = Math.round(videoProgress?.highest_percent_watched ?? 0);

  let resumeRoute: PortalRoute;
  if (booked || reviewRequired) {
    resumeRoute = "complete";
  } else if (qualified) {
    resumeRoute = "schedule";
  } else if (videoCompleted) {
    resumeRoute = "questionnaire";
  } else {
    resumeRoute = "overview";
  }

  const fddStatus = effectiveFddStatus(lead);

  let statusLabel: string;
  if (fddStatus !== "not_requested") {
    // The FDD stage follows questionnaire completion, so once a prospect has
    // requested the document that becomes their furthest progression.
    statusLabel = FDD_STATUS_LABELS[fddStatus];
  } else if (booked) {
    statusLabel = "Consultation Scheduled";
  } else if (reviewRequired) {
    statusLabel = "Application Under Review";
  } else if (qualified) {
    statusLabel = "Consultation Approved — Scheduling Pending";
  } else if (questionnaireCompleted) {
    statusLabel = "Qualification Under Review";
  } else if (videoCompleted) {
    statusLabel = "Qualification Questionnaire Pending";
  } else if (videoStarted) {
    statusLabel = "Investor Overview In Progress";
  } else {
    statusLabel = "Investor Overview Pending";
  }

  const scheduleDone = booked;
  const checklist = [
    {
      key: "info",
      label: "Initial Information Received",
      done: true,
      current: false,
    },
    {
      key: "video",
      label: "Watch Investor Overview",
      done: videoCompleted,
      current: !videoCompleted,
    },
    {
      key: "questionnaire",
      label: "Complete Qualification Questionnaire",
      done: questionnaireCompleted,
      current: videoCompleted && !questionnaireCompleted,
    },
    {
      key: "schedule",
      label: "Schedule Consultation",
      done: scheduleDone,
      current: qualified && !booked,
    },
  ];

  return {
    videoStarted,
    videoCompleted,
    videoPercent,
    questionnaireCompleted,
    qualified,
    reviewRequired,
    booked,
    resumeRoute,
    checklist,
    statusLabel,
  };
}

export function routeForState(token: string, route: PortalRoute): string {
  const base = `/p/${token}`;
  return route === "dashboard" ? base : `${base}/${route}`;
}
