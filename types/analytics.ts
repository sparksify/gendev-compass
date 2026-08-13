export type PortalEventName =
  | "lead_created"
  | "start_claimed"
  | "portal_opened"
  | "overview_page_opened"
  | "opportunity_overview_opened"
  | "faq_opened"
  | "resources_opened"
  | "ownership_profile_opened"
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
  | "territory_alternative_selected"
  // Tracking & Attribution taxonomy additions (Phase 11). Existing events
  // above already cover most of the canonical list in
  // docs/tracking-attribution.md; these fill the remaining gaps so the type
  // system enforces the full taxonomy even where UI wiring is incremental.
  | "portal_returned"
  | "questionnaire_viewed"
  | "resource_viewed"
  | "resource_downloaded"
  | "advisor_overflow_presented"
  | "advisor_presented"
  | "advisor_selected"
  | "advisor_booked"
  | "appointment_booked"
  | "precall_questions_submitted"
  | "territory_check_started"
  | "territory_check_completed"
  | "lead_review_required";

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
