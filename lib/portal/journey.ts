import type { PortalState } from "@/types/portal";

/**
 * Derives the seven-milestone investor journey from real portal state.
 * The Operations Call, Q&A Zoom, and Investment Review are post-consultation
 * stages that exist in the timeline today and activate in later releases.
 */

export type MilestoneStatus = "completed" | "active" | "locked" | "future";

export interface JourneyMilestone {
  key: string;
  label: string;
  status: MilestoneStatus;
  /** Optional short state note, e.g. "Under review". */
  note?: string;
}

export interface JourneySummary {
  milestones: JourneyMilestone[];
  /** Overall completion of the actionable V1 journey, 0–100. */
  overallPercent: number;
  /** Rough remaining effort in minutes; null once booked. */
  timeRemainingMinutes: number | null;
  currentMilestoneLabel: string;
  /** Friendly status line for the Progress Summary card. */
  currentStatusLabel: string;
  nextMilestoneLabel: string | null;
}

/** Weights for overall completion (sums to 100 across the V1 journey). */
const WEIGHTS = { application: 15, video: 35, questionnaire: 25, consultation: 25 };

/** Rough effort estimates in minutes, used for "time remaining". */
const EFFORT = { video: 22, questionnaire: 15, schedule: 2 };

export function deriveJourney(state: PortalState): JourneySummary {
  // The overview is an optional educational path: completing the
  // questionnaire (fast track) satisfies the milestone as well.
  const overviewSatisfied = state.videoCompleted || state.questionnaireCompleted;
  const videoFraction = overviewSatisfied ? 1 : Math.min(1, state.videoPercent / 100);

  const milestones: JourneyMilestone[] = [
    { key: "application", label: "Initial Application", status: "completed" },
    {
      key: "overview",
      label: "Investor Overview",
      status: overviewSatisfied ? "completed" : "active",
    },
    {
      key: "questionnaire",
      label: "Investor Alignment",
      status: state.questionnaireCompleted
        ? "completed"
        : state.videoCompleted
          ? "active"
          : "locked",
    },
    {
      key: "consultation",
      label: "Schedule Consultation",
      // Scheduling opens the moment the questionnaire is submitted — the
      // advisor reviews responses before the call; there is no approval gate.
      status: state.booked ? "completed" : state.questionnaireCompleted ? "active" : "locked",
    },
    { key: "operations-call", label: "Attend Operations Call", status: "future" },
    { key: "qa-zoom", label: "Attend Q&A Zoom", status: "future" },
    { key: "investment-review", label: "Investment Review", status: "future" },
  ];

  const overallPercent = Math.round(
    WEIGHTS.application +
      WEIGHTS.video * videoFraction +
      (state.questionnaireCompleted ? WEIGHTS.questionnaire : 0) +
      (state.booked ? WEIGHTS.consultation : 0),
  );

  let timeRemainingMinutes: number | null = null;
  if (!state.booked) {
    timeRemainingMinutes = Math.max(
      1,
      Math.round(
        EFFORT.video * (1 - videoFraction) +
          (state.questionnaireCompleted ? 0 : EFFORT.questionnaire) +
          EFFORT.schedule,
      ),
    );
  }

  const active = milestones.find((m) => m.status === "active");
  const currentIndex = active
    ? milestones.indexOf(active)
    : milestones.findIndex((m) => m.status !== "completed");
  const current = active ?? milestones[Math.max(0, currentIndex)];
  const next = milestones
    .slice(milestones.indexOf(current) + 1)
    .find((m) => m.status !== "future");

  const currentStatusLabel = state.booked
    ? "Consultation Scheduled"
    : `Awaiting ${current.label}`;

  return {
    milestones,
    overallPercent,
    timeRemainingMinutes,
    currentMilestoneLabel: state.booked ? "Consultation Scheduled" : current.label,
    currentStatusLabel,
    nextMilestoneLabel: state.booked ? "Attend Operations Call" : (next?.label ?? null),
  };
}
