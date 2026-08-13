import { effectiveFddStatus } from "@/lib/fdd/status";
import { formatRelative } from "@/lib/advisor/format";
import type { AppointmentRecord } from "@/types/advisor";
import type { LeadRecord } from "@/types/lead";
import type { QuestionnaireRecord } from "@/types/questionnaire";
import type { VideoProgressRecord } from "@/types/portal";

export type NextBestActionIcon = "calendar" | "video" | "fdd" | "review" | "consultation" | "none";

export interface NextBestAction {
  icon: NextBestActionIcon;
  title: string;
  description: string;
  /** Present only when there's a concrete, safe action to offer (a reminder
   * email pre-filled for this lead's situation). */
  reminder: { subject: string; body: string } | null;
}

/**
 * Turns suggestNextAction's terse label into the fuller card shown on the
 * client detail page (title + supporting context + an optional one-click
 * reminder email). Derivation only — never writes anything.
 */
export function deriveNextBestAction(
  lead: LeadRecord,
  questionnaire: QuestionnaireRecord | null,
  video: VideoProgressRecord | null,
  appointments: AppointmentRecord[],
): NextBestAction {
  const name = lead.first_name;
  const activeAppointment = appointments.find(
    (a) => a.status === "SCHEDULED" || a.status === "RESCHEDULED",
  );
  const completed = appointments.find((a) => a.status === "COMPLETED");
  const cancelled = appointments.find((a) => a.status === "CANCELLED");
  const fddStatus = effectiveFddStatus(lead);

  if (lead.current_stage === "NOT_A_FIT" || lead.current_stage === "CLOSED_INVESTED") {
    return {
      icon: "none",
      title: "No action needed",
      description:
        lead.current_stage === "CLOSED_INVESTED"
          ? `${name} has closed as invested — this record is for reference.`
          : `${name} was marked not a fit — no further follow-up is expected.`,
      reminder: null,
    };
  }

  if (fddStatus === "fdd_sent" || fddStatus === "fdd_delivered") {
    return {
      icon: "fdd",
      title: "Follow up on FDD",
      description: `The Franchise Disclosure Document was sent ${formatRelative(lead.fdd_sent_at ?? lead.fdd_delivered_at)} and hasn't been acknowledged yet.`,
      reminder: {
        subject: "Checking in on your Franchise Disclosure Document",
        body: `Hi ${name},\n\nJust checking in — did you receive the Franchise Disclosure Document we sent over? Happy to answer any questions as you review it.\n\nBest,`,
      },
    };
  }

  if (cancelled && !activeAppointment && !completed) {
    return {
      icon: "calendar",
      title: "Rebook cancelled consultation",
      description: `${name}'s consultation was cancelled — reach out to find a new time.`,
      reminder: {
        subject: "Let's find a new time to connect",
        body: `Hi ${name},\n\nI noticed our consultation got cancelled — I'd love to find another time that works for you. Let me know what your schedule looks like this week.\n\nBest,`,
      },
    };
  }

  if (activeAppointment || (lead.booked_at && !completed && lead.current_stage === "CONSULTATION_SCHEDULED")) {
    return {
      icon: "consultation",
      title: "Prepare for consultation",
      description: activeAppointment?.scheduled_start
        ? `Consultation is scheduled — review their profile before you meet.`
        : `A consultation is booked — review their profile before you meet.`,
      reminder: null,
    };
  }

  if (lead.current_stage === "CONSULTATION_COMPLETED") {
    return {
      icon: "review",
      title: "Review outcome and update stage",
      description: `The consultation with ${name} is complete — log the outcome and move them to the next stage.`,
      reminder: null,
    };
  }

  if (questionnaire && !activeAppointment && !completed && !lead.booked_at) {
    return {
      icon: "calendar",
      title: "Schedule follow-up",
      description: `${name} completed the questionnaire ${formatRelative(lead.questionnaire_completed_at)} but hasn't booked a consultation.`,
      reminder: {
        subject: "Ready to schedule your consultation?",
        body: `Hi ${name},\n\nThanks for completing the questionnaire! I'd love to schedule a time to talk through your goals — do any of the times on my calendar work for you?\n\nBest,`,
      },
    };
  }

  if (!lead.questionnaire_started_at && !questionnaire) {
    const opened = Boolean(lead.portal_first_opened_at);
    return {
      icon: "video",
      title: opened ? "Follow up on questionnaire" : "Follow up on new lead",
      description: opened
        ? `The questionnaire was opened ${formatRelative(lead.portal_first_opened_at)} but not yet completed.`
        : `${name} hasn't opened their portal yet.`,
      reminder: {
        subject: opened ? "Finish your investor questionnaire" : "Welcome — let's get started",
        body: opened
          ? `Hi ${name},\n\nJust a quick nudge — you started your investor questionnaire but haven't finished it yet. It only takes a few minutes and helps me prepare for our conversation.\n\nBest,`
          : `Hi ${name},\n\nWelcome! Your private investor portal is ready whenever you are — it walks through the opportunity and takes just a few minutes.\n\nBest,`,
      },
    };
  }

  if (
    lead.questionnaire_started_at &&
    !questionnaire &&
    video &&
    video.highest_percent_watched >= 40
  ) {
    return {
      icon: "video",
      title: "Encourage questionnaire completion",
      description: `${name} has watched ${Math.round(video.highest_percent_watched)}% of the overview video but hasn't finished the questionnaire.`,
      reminder: {
        subject: "Finish your investor questionnaire",
        body: `Hi ${name},\n\nGreat progress on the overview video! Whenever you're ready, finishing the short questionnaire helps me tailor our conversation to your goals.\n\nBest,`,
      },
    };
  }

  return {
    icon: "review",
    title: "Check in",
    description: `Last activity ${formatRelative(lead.last_activity_at ?? lead.created_at)} — a quick check-in keeps momentum going.`,
    reminder: {
      subject: "Checking in",
      body: `Hi ${name},\n\nJust wanted to check in and see how things are going, and whether you have any questions I can help with.\n\nBest,`,
    },
  };
}
