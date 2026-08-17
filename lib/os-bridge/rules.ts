/**
 * Policy table for the AI Employee OS bridge — which recorded events are
 * forwarded to the OS webhook. Mirrors the notification rules philosophy
 * (lib/notifications/rules.ts): unknown events are NOT forwarded by default,
 * so adding an event type can never accidentally widen the firehose.
 *
 * Curation rationale: the OS folds these into a per-candidate behavioral
 * rollup its AI employees read on every decision. Page pings and 25% video
 * ticks add prompt noise without decision signal; 50%+ engagement, funnel
 * milestones, and anything appointment-shaped are the signal.
 */

const FORWARDED = new Set<string>([
  "portal_opened",
  "portal_returned",
  "video_started",
  "video_progress_50",
  "video_progress_75",
  "video_completion_threshold_reached",
  "client_questionnaire_started",
  "questionnaire_submitted",
  "lead_qualified",
  "appointment_booked",
  "consultation_booked",
  "consultation_rescheduled",
  "consultation_cancelled",
  "consultation_completed",
  "consultation_no_show",
]);

const FORWARDED_PREFIXES = ["fdd_"];

/** Event names are normalized for the OS: the client_ spoof-guard prefix is dropped. */
export function resolveBridgeEvent(eventName: string): string | null {
  if (FORWARDED.has(eventName)) {
    return eventName === "client_questionnaire_started" ? "questionnaire_started" : eventName;
  }
  if (FORWARDED_PREFIXES.some((p) => eventName.startsWith(p))) return eventName;
  return null;
}
