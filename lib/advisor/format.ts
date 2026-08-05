/** Display formatting shared by the advisor pages (server components). */

export function formatDateTime(iso: string | null | undefined, timeZone?: string | null): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      ...(timeZone ? { timeZone } : {}),
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function formatRelative(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return "—";
  const ms = now.getTime() - new Date(iso).getTime();
  if (ms < 0) return formatDateTime(iso);
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(iso);
}

export function formatWatchTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.round(totalSeconds % 60);
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

/** Human label for a stored event name (portal + advisor events). */
export function eventLabel(eventName: string): string {
  const labels: Record<string, string> = {
    lead_created: "Lead created",
    portal_opened: "Portal opened",
    overview_page_opened: "Overview page opened",
    opportunity_overview_opened: "Opportunity page opened",
    video_started: "Video started",
    video_progress_25: "Video 25% watched",
    video_progress_50: "Video 50% watched",
    video_progress_75: "Video 75% watched",
    video_completion_threshold_reached: "Video completed",
    questionnaire_opened: "Questionnaire opened",
    questionnaire_started: "Questionnaire started",
    questionnaire_submitted: "Questionnaire submitted",
    lead_qualified: "Marked qualified by scoring",
    lead_sent_to_review: "Flagged for review by scoring",
    calendar_opened: "Calendar opened",
    calendar_booking_completed: "Consultation booked",
    consultation_booked: "Consultation booked",
    consultation_rescheduled: "Consultation rescheduled",
    consultation_cancelled: "Consultation cancelled",
    consultation_completed: "Consultation completed",
    consultation_no_show: "Consultation no-show",
    fdd_requested: "FDD requested",
    fdd_request_failed: "FDD request failed",
    fdd_sent: "FDD sent",
    fdd_delivered: "FDD delivered",
    fdd_received: "FDD acknowledged",
    fdd_waiting_period_started: "FDD waiting period started",
    fdd_eligible: "Eligible for franchise agreement",
    fdd_advisor_notified: "Advisor notified of FDD activity",
    note_added: "Note added",
    stage_changed: "Stage changed",
    advisor_assigned: "Advisor assigned",
    portal_completed: "Portal journey completed",
  };
  if (labels[eventName]) return labels[eventName];
  if (eventName.startsWith("client_")) {
    return `Client: ${eventName.slice(7).replace(/_/g, " ")}`;
  }
  return eventName.replace(/_/g, " ");
}

/** Label for a GoHighLevel calendar event's raw appointmentStatus. */
export function ghlAppointmentStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    confirmed: "Confirmed",
    new: "New",
    cancelled: "Cancelled",
    showed: "Showed",
    noshow: "No-show",
    invalid: "Invalid",
  };
  return labels[status] ?? status.replace(/_/g, " ");
}

export function eventSourceLabel(source: string | null | undefined): string {
  const labels: Record<string, string> = {
    portal: "Portal",
    staff: "Staff",
    system: "System",
    webhook_calendar: "Calendar",
    webhook_fdd: "FDD Provider",
    seed: "Seed",
  };
  return labels[source ?? "portal"] ?? (source || "Portal");
}
