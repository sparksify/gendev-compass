import { effectiveFddStatus } from "@/lib/fdd/status";
import { formatDate, formatRelative } from "@/lib/advisor/format";
import type { AppointmentRecord } from "@/types/advisor";
import type { LeadRecord } from "@/types/lead";
import type { QuestionnaireRecord } from "@/types/questionnaire";
import type { VideoProgressRecord } from "@/types/portal";
import type { PortalEventRecord } from "@/types/analytics";

export type NextBestActionIcon =
  | "calendar"
  | "video"
  | "fdd"
  | "review"
  | "consultation"
  | "contact"
  | "none";

export interface NextBestAction {
  icon: NextBestActionIcon;
  title: string;
  description: string;
  /** One short, generic sentence explaining why this category of action
   * matters — keyed to the same branch that produced the recommendation,
   * not per-lead fabricated commentary. */
  whyItMatters: string | null;
  /** Present only when there's a concrete, safe action to offer (a reminder
   * email pre-filled for this lead's situation). */
  reminder: { subject: string; body: string } | null;
  /** Label for the reminder CTA button; only meaningful when reminder is set. */
  ctaLabel: string;
}

function hoursSince(iso: string, now: Date): number {
  return (now.getTime() - new Date(iso).getTime()) / 3_600_000;
}

/**
 * Turns real lead/questionnaire/video/appointment/event state into the
 * single highest-priority recommendation shown on the client detail page.
 * Every branch is grounded in state or timestamps already on the record —
 * nothing here is invented per lead. Derivation only — never writes
 * anything.
 */
export function deriveNextBestAction(
  lead: LeadRecord,
  questionnaire: QuestionnaireRecord | null,
  video: VideoProgressRecord | null,
  appointments: AppointmentRecord[],
  events: PortalEventRecord[] = [],
  notesCount = 0,
  now: Date = new Date(),
): NextBestAction {
  const name = lead.first_name;
  const activeAppointment = appointments.find(
    (a) => a.status === "SCHEDULED" || a.status === "RESCHEDULED",
  );
  const completed = appointments.find((a) => a.status === "COMPLETED");
  const cancelled = appointments.find((a) => a.status === "CANCELLED");
  const fddStatus = effectiveFddStatus(lead, now);

  if (lead.current_stage === "NOT_A_FIT" || lead.current_stage === "CLOSED_INVESTED") {
    return {
      icon: "none",
      title: "No action needed",
      description:
        lead.current_stage === "CLOSED_INVESTED"
          ? `${name} has closed as invested — this record is for reference.`
          : `${name} was marked not a fit — no further follow-up is expected.`,
      whyItMatters: null,
      reminder: null,
      ctaLabel: "Send Reminder",
    };
  }

  // Consultation completed, FDD never requested — the concrete next step is
  // deciding whether they're ready for the document, not a generic nudge.
  if (lead.current_stage === "CONSULTATION_COMPLETED" && fddStatus === "not_requested") {
    return {
      icon: "review",
      title: "Determine FDD readiness",
      description: `${name}'s consultation is complete and no FDD has been requested yet — decide whether they're ready to receive it.`,
      whyItMatters:
        "Franchise Disclosure Documents start a legal waiting period the moment they're sent — request one only once the candidate is genuinely ready.",
      reminder: null,
      ctaLabel: "Send Reminder",
    };
  }

  if (fddStatus === "fdd_sent") {
    return {
      icon: "fdd",
      title: "Monitor FDD waiting period",
      description: `The Franchise Disclosure Document was sent ${formatRelative(lead.fdd_sent_at, now)} — no action needed until it's acknowledged or the waiting period completes.`,
      whyItMatters: null,
      reminder: null,
      ctaLabel: "Send Reminder",
    };
  }

  if (fddStatus === "fdd_delivered") {
    return {
      icon: "fdd",
      title: "Follow up on FDD",
      description: `The FDD was delivered ${formatRelative(lead.fdd_delivered_at, now)} and hasn't been acknowledged yet.`,
      whyItMatters: "A document that's delivered but unopened usually just needs a nudge, not a resend.",
      reminder: {
        subject: "Checking in on your Franchise Disclosure Document",
        body: `Hi ${name},\n\nJust checking in — did you receive the Franchise Disclosure Document we sent over? Happy to answer any questions as you review it.\n\nBest,`,
      },
      ctaLabel: "Send Reminder",
    };
  }

  if (cancelled && !activeAppointment && !completed) {
    return {
      icon: "calendar",
      title: "Rebook cancelled consultation",
      description: `${name}'s consultation was cancelled — reach out to find a new time.`,
      whyItMatters: null,
      reminder: {
        subject: "Let's find a new time to connect",
        body: `Hi ${name},\n\nI noticed our consultation got cancelled — I'd love to find another time that works for you. Let me know what your schedule looks like this week.\n\nBest,`,
      },
      ctaLabel: "Send Reminder",
    };
  }

  if (activeAppointment || (lead.booked_at && !completed && lead.current_stage === "CONSULTATION_SCHEDULED")) {
    const when = activeAppointment?.scheduled_start ? formatDate(activeAppointment.scheduled_start) : null;
    return {
      icon: "consultation",
      title: "Prepare for consultation",
      description: when
        ? `Review their qualification profile and recent activity before your ${when} consultation.`
        : `A consultation is booked — review their qualification profile and recent activity before you meet.`,
      whyItMatters: null,
      reminder: null,
      ctaLabel: "Send Reminder",
    };
  }

  if (lead.current_stage === "CONSULTATION_COMPLETED") {
    return {
      icon: "review",
      title: "Review outcome and update stage",
      description: `The consultation with ${name} is complete — log the outcome and move them to the next stage.`,
      whyItMatters: null,
      reminder: null,
      ctaLabel: "Send Reminder",
    };
  }

  if (questionnaire && !activeAppointment && !completed && !lead.booked_at) {
    return {
      icon: "calendar",
      title: "Schedule follow-up",
      description: `${name} completed the questionnaire ${formatRelative(lead.questionnaire_completed_at, now)} but hasn't booked a consultation.`,
      whyItMatters:
        "Candidates who complete qualification but don't book within 48 hours are the most likely to go cold without advisor follow-up.",
      reminder: {
        subject: "Ready to schedule your consultation?",
        body: `Hi ${name},\n\nThanks for completing the questionnaire! I'd love to schedule a time to talk through your goals — do any of the times on my calendar work for you?\n\nBest,`,
      },
      ctaLabel: "Send Reminder",
    };
  }

  if (!lead.questionnaire_started_at && !questionnaire) {
    const opened = Boolean(lead.portal_first_opened_at);
    return {
      icon: "video",
      title: opened ? "Follow up on questionnaire" : "Follow up on new lead",
      description: opened
        ? `The questionnaire was opened ${formatRelative(lead.portal_first_opened_at, now)} but not yet completed.`
        : `${name} hasn't opened their portal yet.`,
      whyItMatters: null,
      reminder: {
        subject: opened ? "Finish your investor questionnaire" : "Welcome — let's get started",
        body: opened
          ? `Hi ${name},\n\nJust a quick nudge — you started your investor questionnaire but haven't finished it yet. It only takes a few minutes and helps me prepare for our conversation.\n\nBest,`
          : `Hi ${name},\n\nWelcome! Your private investor portal is ready whenever you are — it walks through the opportunity and takes just a few minutes.\n\nBest,`,
      },
      ctaLabel: "Send Reminder",
    };
  }

  // Watched some of the overview, then went quiet for a couple of days,
  // with no questionnaire started yet — worth a re-engagement nudge.
  if (
    !questionnaire &&
    video &&
    video.highest_percent_watched > 0 &&
    video.highest_percent_watched < 85 &&
    video.last_event_at &&
    hoursSince(video.last_event_at, now) >= 48
  ) {
    const days = Math.floor(hoursSince(video.last_event_at, now) / 24);
    return {
      icon: "video",
      title: "Re-engage candidate",
      description: `${name} watched ${Math.round(video.highest_percent_watched)}% of the overview but hasn't returned in ${days} day${days === 1 ? "" : "s"}.`,
      whyItMatters: null,
      reminder: {
        subject: "Still interested in learning more?",
        body: `Hi ${name},\n\nI noticed you started the overview video — happy to answer any questions if you'd like to pick up where you left off.\n\nBest,`,
      },
      ctaLabel: "Send Reminder",
    };
  }

  // Returned repeatedly and finished the overview, but no advisor note is
  // on file yet — a real signal of interest nobody has acted on.
  const portalReturnCount = events.filter((e) => e.event_name === "portal_opened").length;
  if (video?.completed && portalReturnCount >= 3 && notesCount === 0) {
    return {
      icon: "contact",
      title: "Contact candidate",
      description: `${name} has opened the portal ${portalReturnCount} times and completed the overview video — no advisor notes are on file yet.`,
      whyItMatters: "Repeated returns without outreach usually mean a warm candidate is waiting to hear from you.",
      reminder: {
        subject: "Following up on your interest",
        body: `Hi ${name},\n\nI can see you've been exploring the opportunity — I'd love to connect and answer any questions you have.\n\nBest,`,
      },
      ctaLabel: "Call Candidate",
    };
  }

  return {
    icon: "review",
    title: "Check in",
    description: `Last activity ${formatRelative(lead.last_activity_at ?? lead.created_at, now)} — a quick check-in keeps momentum going.`,
    whyItMatters: null,
    reminder: {
      subject: "Checking in",
      body: `Hi ${name},\n\nJust wanted to check in and see how things are going, and whether you have any questions I can help with.\n\nBest,`,
    },
    ctaLabel: "Send Reminder",
  };
}
