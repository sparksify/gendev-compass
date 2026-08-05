/**
 * Internal advisor-backend domain types. The canonical investor record is
 * the existing LeadRecord (types/lead.ts); these types cover the staff-side
 * entities added by the advisor MVP.
 */

export type StaffRole = "ADMIN" | "ADVISOR";

export interface StaffUserRecord {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  password_hash: string;
  role: StaffRole;
  active: boolean;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
}

export interface StaffSessionRecord {
  id: string;
  staff_user_id: string;
  token_hash: string;
  expires_at: string;
  created_at: string;
}

export const INVESTOR_STAGES = [
  "NEW_LEAD",
  "PORTAL_ACTIVE",
  "ENGAGED",
  "QUESTIONNAIRE_STARTED",
  "QUESTIONNAIRE_COMPLETED",
  "CONSULTATION_SCHEDULED",
  "CONSULTATION_COMPLETED",
  "FDD_SENT",
  "FDD_ACKNOWLEDGED",
  "DUE_DILIGENCE",
  "QUALIFIED",
  "NOT_A_FIT",
  "CLOSED_INVESTED",
] as const;

export type InvestorStage = (typeof INVESTOR_STAGES)[number];

export const STAGE_LABELS: Record<InvestorStage, string> = {
  NEW_LEAD: "New Lead",
  PORTAL_ACTIVE: "Portal Active",
  ENGAGED: "Engaged",
  QUESTIONNAIRE_STARTED: "Questionnaire Started",
  QUESTIONNAIRE_COMPLETED: "Questionnaire Completed",
  CONSULTATION_SCHEDULED: "Consultation Scheduled",
  CONSULTATION_COMPLETED: "Consultation Completed",
  FDD_SENT: "FDD Sent",
  FDD_ACKNOWLEDGED: "FDD Acknowledged",
  DUE_DILIGENCE: "Due Diligence",
  QUALIFIED: "Qualified",
  NOT_A_FIT: "Not a Fit",
  CLOSED_INVESTED: "Closed / Invested",
};

export const APPOINTMENT_STATUSES = [
  "SCHEDULED",
  "RESCHEDULED",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
] as const;

export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export interface AppointmentRecord {
  id: string;
  lead_id: string;
  advisor_id: string | null;
  external_appointment_id: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  time_zone: string | null;
  status: AppointmentStatus;
  booking_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdvisorNoteRecord {
  id: string;
  lead_id: string;
  staff_user_id: string;
  note: string;
  created_at: string;
  updated_at: string;
}

export interface QuestionnaireSubmissionRecord {
  id: string;
  lead_id: string;
  questionnaire_version: string;
  submitted_at: string;
  created_at: string;
}

export interface QuestionnaireAnswerRecord {
  id: string;
  submission_id: string;
  question_key: string;
  question_text: string;
  answer_value: string;
  answer_display_value: string;
  created_at: string;
}

export interface QuestionnaireSubmissionWithAnswers extends QuestionnaireSubmissionRecord {
  answers: QuestionnaireAnswerRecord[];
}
