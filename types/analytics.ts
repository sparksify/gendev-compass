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
  | "portal_completed";

export interface PortalEventRecord {
  id: string;
  lead_id: string;
  event_name: string;
  event_data: Record<string, unknown> | null;
  page_url: string | null;
  created_at: string;
}
