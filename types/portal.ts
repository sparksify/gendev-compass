export interface VideoProgressRecord {
  id: string;
  lead_id: string;
  wistia_media_id: string | null;
  highest_percent_watched: number;
  accumulated_seconds_watched: number;
  last_playhead_position: number;
  started: boolean;
  completed: boolean;
  play_count: number;
  first_played_at: string | null;
  last_event_at: string | null;
  created_at: string;
  updated_at: string;
  /** Platform domain links (nullable during the transition). */
  organization_id: string | null;
  client_id: string | null;
  opportunity_id: string | null;
  brand_id: string | null;
}

export type PortalRoute = "dashboard" | "overview" | "questionnaire" | "schedule" | "complete";

export interface PortalChecklistItem {
  key: string;
  label: string;
  done: boolean;
  current: boolean;
}

export interface PortalState {
  videoStarted: boolean;
  videoCompleted: boolean;
  videoPercent: number;
  questionnaireCompleted: boolean;
  qualified: boolean;
  reviewRequired: boolean;
  booked: boolean;
  fddRequested: boolean;
  fddAcknowledged: boolean;
  /** The furthest route the prospect should currently be sent to. */
  resumeRoute: PortalRoute;
  checklist: PortalChecklistItem[];
  statusLabel: string;
}
