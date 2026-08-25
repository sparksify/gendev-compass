import type { PortalEventName } from "@/types/analytics";
import type { NotificationChannel } from "@/types/notifications";

/**
 * The single place notification policy lives.
 *
 * Every recorded event is evaluated against this table. Nothing else in the
 * codebase decides whether to email — route handlers and services record
 * events and stop there. Turning a new event into an email is a one-line
 * change here.
 *
 * Event names are the existing PortalEventName values (types/analytics.ts)
 * rather than a parallel vocabulary. The mapping from the product-level
 * names to the ones the code actually emits:
 *
 *   PORTAL_OPENED                -> portal_opened
 *   OVERVIEW_VIDEO_STARTED       -> video_started
 *   OVERVIEW_VIDEO_25/50/75      -> video_progress_25 / _50 / _75
 *   OVERVIEW_VIDEO_COMPLETED     -> video_completion_threshold_reached
 *   QUESTIONNAIRE_STARTED        -> client_questionnaire_started
 *   QUESTIONNAIRE_COMPLETED      -> questionnaire_submitted
 *   CONSULTATION_SCHEDULED       -> calendar_booking_completed | consultation_booked
 *   STRATEGIST_REVIEW_REQUESTED  -> territory_review_requested
 *   TERRITORY_CHECKED            -> territory_search_submitted
 */

export type NotificationAction = "immediate_email" | "dashboard_only";

export interface NotificationRule {
  action: NotificationAction;
  channel: NotificationChannel;
  templateKey: EmailTemplateKey;
  /**
   * Events that mean the same thing to an advisor share a group, so a lead
   * is emailed at most once for it. `calendar_booking_completed` (portal
   * confirmation) and `consultation_booked` (provider webhook) both describe
   * one booking and must not produce two emails.
   */
  dedupeGroup: string;
  /**
   * Optional extra scope pulled from the event payload — a new questionnaire
   * version is a legitimately new completion and may email again.
   */
  dedupeScope?: (eventData: Record<string, unknown> | null) => string | null;
  /**
   * Fixed additional recipients CC'd on every send of this rule, on top of
   * the resolved advisor. Deduped against the primary recipient at send
   * time; when no advisor resolves at all, the first CC is promoted to the
   * primary recipient so the notification is never lost.
   */
  ccEmails?: string[];
}

/**
 * Everyone who must see every completed questionnaire, regardless of which
 * advisor the investor is assigned to. Override (comma-separated) via
 * QUESTIONNAIRE_NOTIFICATION_CC; set it to an empty string to disable.
 */
function questionnaireCcEmails(): string[] {
  const raw = process.env.QUESTIONNAIRE_NOTIFICATION_CC;
  if (raw === undefined) return ["darko@frangendev.com"];
  return raw
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);
}

export type EmailTemplateKey =
  | "questionnaire_completed"
  | "consultation_scheduled"
  | "booking_claimed"
  | "strategist_review_requested"
  | "video_completed"
  | "ownership_profile_completed";

/** Events recorded for the dashboard/timeline but deliberately silent. */
const DASHBOARD_ONLY: readonly string[] = [
  "portal_opened",
  "video_started",
  "video_progress_25",
  "video_progress_50",
  "video_progress_75",
  "questionnaire_started",
  "client_questionnaire_started",
  "territory_search_submitted",
  // Opening the assessment says nothing; finishing it does (see IMMEDIATE).
  "ownership_profile_opened",
];

const IMMEDIATE: Partial<Record<PortalEventName, NotificationRule>> = {
  // The V1 headline: an advisor should know the moment someone qualifies.
  questionnaire_submitted: {
    action: "immediate_email",
    channel: "email",
    templateKey: "questionnaire_completed",
    dedupeGroup: "questionnaire_completed",
    dedupeScope: (data) => asString(data?.questionnaireVersion),
    ccEmails: questionnaireCcEmails(),
  },

  // Rich pre-call context: what the investor wants from ownership, in their
  // own selections. The route only emits this on the first real completion.
  ownership_profile_completed: {
    action: "immediate_email",
    channel: "email",
    templateKey: "ownership_profile_completed",
    dedupeGroup: "ownership_profile_completed",
  },

  // One booking, two possible sources — same group, so one email.
  calendar_booking_completed: {
    action: "immediate_email",
    channel: "email",
    templateKey: "consultation_scheduled",
    dedupeGroup: "consultation_scheduled",
  },
  consultation_booked: {
    action: "immediate_email",
    channel: "email",
    templateKey: "consultation_scheduled",
    dedupeGroup: "consultation_scheduled",
  },

  // A self-reported "I booked" with no calendar evidence — the advisor must
  // verify (call the prospect or check the calendar). Its own group so a
  // later verified booking still sends the real confirmation email.
  booking_claimed: {
    action: "immediate_email",
    channel: "email",
    templateKey: "booking_claimed",
    dedupeGroup: "booking_claimed",
  },

  // A prospect asking for a human read on a territory is a real buying signal.
  territory_review_requested: {
    action: "immediate_email",
    channel: "email",
    templateKey: "strategist_review_requested",
    // Each request is its own ask, so scope by request id.
    dedupeGroup: "strategist_review_requested",
    dedupeScope: (data) => asString(data?.reviewRequestId),
  },
};

/**
 * Video completion records an event always, but only emails when explicitly
 * enabled. Watching a video is weaker intent than completing qualification,
 * and this is the setting most likely to cause notification fatigue.
 *
 * This is also the seam for future composite rules ("video completed AND
 * questionnaire completed"): resolveNotificationRule receives the lead's
 * event, so a richer predicate lands here without touching page code.
 */
function videoCompletedRule(): NotificationRule {
  return {
    action: emailOnVideoCompleted() ? "immediate_email" : "dashboard_only",
    channel: "email",
    templateKey: "video_completed",
    dedupeGroup: "video_completed",
  };
}

export function emailOnVideoCompleted(): boolean {
  return process.env.NOTIFY_ON_VIDEO_COMPLETED === "true";
}

/**
 * Resolves the policy for a recorded event. Unknown events are dashboard-only
 * by default: adding an event type can never accidentally start emailing.
 */
export function resolveNotificationRule(eventName: string): NotificationRule | null {
  if (eventName === "video_completion_threshold_reached") {
    const rule = videoCompletedRule();
    return rule.action === "immediate_email" ? rule : null;
  }
  if (DASHBOARD_ONLY.includes(eventName)) return null;
  return IMMEDIATE[eventName as PortalEventName] ?? null;
}

/**
 * The uniqueness key a delivery claims before sending. Scoped to the lead so
 * two investors hitting the same milestone both get through, and to the
 * group so alternate paths for one real-world action collapse into one email.
 */
export function buildDedupeKey(
  leadId: string,
  rule: NotificationRule,
  eventData: Record<string, unknown> | null,
): string {
  const scope = rule.dedupeScope?.(eventData) ?? null;
  return [leadId, rule.dedupeGroup, rule.channel, scope].filter(Boolean).join(":");
}

function asString(value: unknown): string | null {
  if (typeof value === "string" && value.trim().length > 0) return value.trim();
  if (typeof value === "number") return String(value);
  return null;
}
