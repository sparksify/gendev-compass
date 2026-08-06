export type PortalEventName =
  | "lead_created"
  | "portal_opened"
  | "overview_page_opened"
  | "opportunity_overview_opened"
  | "faq_opened"
  | "resources_opened"
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
  | "portal_completed"
  | "fdd_requested"
  | "fdd_request_failed"
  | "fdd_sent"
  | "fdd_delivered"
  | "fdd_received"
  | "fdd_waiting_period_started"
  | "fdd_eligible"
  | "fdd_advisor_notified"
  // Advisor-backend events (calendar webhook + staff actions).
  | "consultation_booked"
  | "consultation_rescheduled"
  | "consultation_cancelled"
  | "consultation_completed"
  | "consultation_no_show"
  | "note_added"
  | "stage_changed"
  | "advisor_assigned"
  // Territory Advisor events.
  | "territory_advisor_viewed"
  | "territory_search_submitted"
  | "territory_search_completed"
  | "territory_search_failed"
  | "territory_result_available"
  | "territory_result_partial"
  | "territory_result_unavailable"
  | "territory_result_state_restricted"
  | "territory_review_requested"
  | "territory_alternative_selected";

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
