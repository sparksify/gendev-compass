export type PortalEventName =
  | "lead_created"
  | "portal_opened"
  | "overview_page_opened"
  | "opportunity_overview_opened"
  | "video_started"
  | "video_progress_25"
  | "video_progress_50"
  | "video_progress_75"
  | "video_completion_threshold_reached"
  | "questionnaire_opened"
  | "questionnaire_started"
  | "questionnaire_submitted"
  | "lead_qualified"
  | "lead_sent_to_review"
  | "calendar_opened"
  | "calendar_booking_completed"
  | "fdd_requested"
  | "fdd_email_sent"
  | "fdd_acknowledged"
  | "portal_completed"
  // Advisor-backend events (webhooks + staff actions).
  | "consultation_booked"
  | "consultation_rescheduled"
  | "consultation_cancelled"
  | "consultation_completed"
  | "consultation_no_show"
  | "fdd_sent"
  | "fdd_delivered"
  | "fdd_opened"
  | "fdd_delivery_failed"
  | "note_added"
  | "stage_changed"
  | "advisor_assigned";

export interface PortalEventRecord {
  id: string;
  lead_id: string;
  event_name: string;
  event_data: Record<string, unknown> | null;
  page_url: string | null;
  /** Where the event originated: portal | webhook_calendar | webhook_fdd | staff | system. */
  event_source: string;
  created_by_staff_user_id: string | null;
  /** Provider-supplied timestamp when available; created_at is ingestion time. */
  occurred_at: string | null;
  created_at: string;
}
