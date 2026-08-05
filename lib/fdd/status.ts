import type { LeadRecord } from "@/types/lead";
import type { FddStatus } from "@/types/fdd";

/**
 * The FDD status to display right now. `eligible_for_agreement` is derived
 * when the configured waiting period has elapsed — the stored timestamps
 * remain the legal record, the countdown is presentation only (spec §6).
 * Pure module: safe to import from both server and client code.
 */
export function effectiveFddStatus(lead: LeadRecord, now: Date = new Date()): FddStatus {
  if (
    (lead.fdd_status === "waiting_period_active" || lead.fdd_status === "fdd_received") &&
    lead.fdd_eligible_at &&
    now.getTime() >= new Date(lead.fdd_eligible_at).getTime()
  ) {
    return "eligible_for_agreement";
  }
  return lead.fdd_status;
}

/** Prospect-facing labels for the portal status chip. */
export const FDD_STATUS_LABELS: Record<FddStatus, string> = {
  not_requested: "FDD Not Requested",
  request_processing: "FDD Requested",
  fdd_sent: "FDD Sent",
  fdd_delivered: "FDD Delivered",
  fdd_received: "FDD Acknowledged",
  waiting_period_active: "FDD Waiting Period Active",
  eligible_for_agreement: "Eligible for Franchise Agreement",
  // Prospects never see integration internals — admins see the real state.
  error_manual_review: "FDD Requested",
};
