/**
 * Franchise Disclosure Document (FDD) workflow types.
 *
 * The status is a controlled field (not derived from timestamps) so the admin
 * team can always see exactly where a prospect is in the process.
 */
export type FddStatus =
  | "not_requested"
  | "request_processing"
  | "fdd_sent"
  | "fdd_delivered"
  | "fdd_received"
  | "waiting_period_active"
  | "eligible_for_agreement"
  | "error_manual_review";

/** Immutable audit trail entry for the FDD workflow. */
export interface FddAuditRecord {
  id: string;
  lead_id: string;
  event: string;
  source: string;
  actor: string;
  external_event_id: string | null;
  ip_address: string | null;
  before_values: Record<string, unknown> | null;
  after_values: Record<string, unknown> | null;
  error: string | null;
  created_at: string;
}

export interface FddAuditInsert {
  lead_id: string;
  event: string;
  source: string;
  actor: string;
  external_event_id?: string | null;
  ip_address?: string | null;
  before_values?: Record<string, unknown> | null;
  after_values?: Record<string, unknown> | null;
  error?: string | null;
}
