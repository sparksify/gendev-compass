import { getStore } from "@/lib/store";
import { fddStatusRank } from "@/lib/store/types";
import { trackEvent } from "@/lib/portal/events";
import { getFddWaitingPeriodDays } from "@/lib/config/fdd";
import { dispatchFddRequest } from "@/lib/fdd/ghl";
import { autoAdvanceStage } from "@/lib/advisor/stages";
import type { LeadRecord } from "@/types/lead";
import type { FddStatus } from "@/types/fdd";
import type { LeadPatch } from "@/lib/store/types";

/**
 * FDD workflow engine. All state transitions run through here so every change
 * lands in the immutable audit log with before/after values (spec §8) and the
 * controlled status field never regresses on late or replayed events (§9).
 */

export interface FddActionContext {
  /** Where the action originated, e.g. 'prospect_dashboard', 'admin_resend'. */
  source: string;
  /** Human or system actor, e.g. 'prospect', 'admin', 'system:webhook'. */
  actor: string;
  ip?: string | null;
}

/** Idempotency key: the same prospect can never trigger two document sends. */
export function fddIdempotencyKey(lead: LeadRecord): string {
  return `fdd_request:${lead.id}`;
}

export function computeFddEligibleAt(receivedAtIso: string): string {
  const receivedAt = new Date(receivedAtIso);
  const eligible = new Date(
    receivedAt.getTime() + getFddWaitingPeriodDays() * 24 * 60 * 60 * 1000,
  );
  return eligible.toISOString();
}

export { effectiveFddStatus } from "@/lib/fdd/status";

export interface RequestFddResult {
  ok: boolean;
  alreadyRequested: boolean;
  lead: LeadRecord;
  error: string | null;
}

/**
 * Handles a prospect (or admin resend) FDD request end to end: idempotency,
 * status transitions, GoHighLevel dispatch, audit trail, and analytics.
 */
export async function requestFdd(
  lead: LeadRecord,
  context: FddActionContext,
  options: { force?: boolean } = {},
): Promise<RequestFddResult> {
  const store = getStore();

  // Duplicate clicks and replays: an in-flight or completed request is never
  // re-dispatched unless an authorized user explicitly resends it.
  const activeRequest =
    lead.fdd_status !== "not_requested" && lead.fdd_status !== "error_manual_review";
  if (activeRequest && !options.force) {
    return { ok: true, alreadyRequested: true, lead, error: null };
  }

  const now = new Date().toISOString();
  const isRetry = lead.fdd_status !== "not_requested";

  const requestPatch: LeadPatch = {
    fdd_status: "request_processing",
    fdd_requested_at: lead.fdd_requested_at ?? now,
    fdd_request_source: context.source,
    fdd_last_error: null,
    ...(isRetry
      ? {
          fdd_retry_count: lead.fdd_retry_count + 1,
          // A resend restarts the delivery lifecycle: the new envelope must
          // be acknowledged afresh. The audit log keeps the prior values.
          fdd_sent_at: null,
          fdd_delivered_at: null,
          fdd_received_at: null,
          fdd_eligible_at: null,
          fdd_provider_envelope_id: null,
        }
      : {}),
  };
  let updated = await store.updateLead(lead.id, requestPatch);

  await store.insertFddAudit({
    lead_id: lead.id,
    event: isRetry ? "fdd_request_retried" : "fdd_requested",
    source: context.source,
    actor: context.actor,
    ip_address: context.ip ?? null,
    before_values: {
      fdd_status: lead.fdd_status,
      ...(isRetry
        ? {
            fdd_sent_at: lead.fdd_sent_at,
            fdd_delivered_at: lead.fdd_delivered_at,
            fdd_received_at: lead.fdd_received_at,
            fdd_eligible_at: lead.fdd_eligible_at,
            fdd_provider_envelope_id: lead.fdd_provider_envelope_id,
          }
        : {}),
    },
    after_values: { fdd_status: "request_processing", fdd_requested_at: updated.fdd_requested_at },
  });
  await trackEvent(updated, "fdd_requested", { source: context.source, retry: isRetry });

  const dispatch = await dispatchFddRequest(updated, fddIdempotencyKey(updated));

  if (!dispatch.ok) {
    updated = await store.updateLead(lead.id, {
      fdd_status: "error_manual_review",
      fdd_last_error: dispatch.error,
    });
    await store.insertFddAudit({
      lead_id: lead.id,
      event: "fdd_request_dispatch_failed",
      source: context.source,
      actor: "system",
      before_values: { fdd_status: "request_processing" },
      after_values: { fdd_status: "error_manual_review" },
      error: dispatch.error,
    });
    await trackEvent(updated, "fdd_request_failed", { mode: dispatch.mode });
    return { ok: false, alreadyRequested: false, lead: updated, error: dispatch.error };
  }

  await store.insertFddAudit({
    lead_id: lead.id,
    event: "fdd_request_accepted_by_ghl",
    source: context.source,
    actor: "system",
    after_values: { mode: dispatch.mode, workflow_ref: dispatch.workflowRef },
  });

  const acceptedPatch: LeadPatch = {
    ...(dispatch.workflowRef ? { fdd_workflow_id: dispatch.workflowRef } : {}),
    // Simulated mode confirms synchronously; real modes wait for the
    // provider callback to stamp fdd_sent_at.
    ...(dispatch.confirmedSent ? { fdd_status: "fdd_sent" as const, fdd_sent_at: now } : {}),
  };
  if (Object.keys(acceptedPatch).length > 0) {
    updated = await store.updateLead(lead.id, acceptedPatch);
  }
  if (dispatch.confirmedSent) {
    await store.insertFddAudit({
      lead_id: lead.id,
      event: "fdd_sent",
      source: dispatch.mode,
      actor: "system",
      after_values: { fdd_sent_at: now },
    });
    await trackEvent(updated, "fdd_sent", { mode: dispatch.mode });
    // Advisor pipeline: the dashboard's stage tracks the document being sent.
    await autoAdvanceStage(updated, "FDD_SENT", "portal");
  }

  await store.insertFddAudit({
    lead_id: lead.id,
    event: "fdd_advisor_notified",
    source: context.source,
    actor: "system",
    after_values: { stage: "fdd_requested" },
  });
  await trackEvent(updated, "fdd_advisor_notified", { stage: "fdd_requested" });

  return { ok: true, alreadyRequested: false, lead: updated, error: null };
}

export type FddProviderEventName = "fdd_sent" | "fdd_delivered" | "fdd_received";

export interface FddProviderEvent {
  event: FddProviderEventName;
  prospect_id?: string | null;
  envelope_id?: string | null;
  event_id?: string | null;
  timestamp?: string | null;
  status?: string | null;
}

export interface ApplyProviderEventResult {
  ok: boolean;
  duplicate: boolean;
  httpStatus: number;
  error: string | null;
}

/**
 * Applies a document-provider/GoHighLevel callback event. Safe against
 * replays (external event id), out-of-order delivery (forward-only status),
 * and unknown envelope ids (rejected for manual review).
 */
export async function applyFddProviderEvent(
  payload: FddProviderEvent,
  ip: string | null,
): Promise<ApplyProviderEventResult> {
  const store = getStore();
  const externalEventId =
    payload.event_id ?? `${payload.event}:${payload.envelope_id ?? payload.prospect_id ?? ""}`;

  if (await store.hasFddAuditEvent(externalEventId)) {
    return { ok: true, duplicate: true, httpStatus: 200, error: null };
  }

  // Match the event to a prospect: by our id first, then by envelope.
  let lead: LeadRecord | null = null;
  if (payload.prospect_id) lead = await store.getLeadById(payload.prospect_id);
  if (!lead && payload.envelope_id) {
    lead = await store.getLeadByFddEnvelopeId(payload.envelope_id);
  }
  if (!lead) {
    console.error(
      `[fdd] webhook event ${payload.event} could not be matched (prospect=${payload.prospect_id}, envelope=${payload.envelope_id})`,
    );
    return { ok: false, duplicate: false, httpStatus: 404, error: "Unknown prospect or envelope" };
  }

  // Envelope mismatch: never silently reassign a signed document.
  if (
    payload.envelope_id &&
    lead.fdd_provider_envelope_id &&
    lead.fdd_provider_envelope_id !== payload.envelope_id
  ) {
    await store.updateLead(lead.id, {
      fdd_status: "error_manual_review",
      fdd_last_error: `Envelope mismatch: expected ${lead.fdd_provider_envelope_id}, received ${payload.envelope_id}`,
    });
    await store.insertFddAudit({
      lead_id: lead.id,
      event: "fdd_envelope_mismatch",
      source: "webhook",
      actor: "system:webhook",
      external_event_id: externalEventId,
      ip_address: ip,
      before_values: { fdd_provider_envelope_id: lead.fdd_provider_envelope_id },
      after_values: { received_envelope_id: payload.envelope_id },
      error: "Envelope id does not match this prospect — flagged for manual review",
    });
    return { ok: false, duplicate: false, httpStatus: 409, error: "Envelope mismatch" };
  }

  const eventAt = payload.timestamp ?? new Date().toISOString();
  const patch: LeadPatch = {};
  if (payload.envelope_id && !lead.fdd_provider_envelope_id) {
    patch.fdd_provider_envelope_id = payload.envelope_id;
  }

  let targetStatus: FddStatus;
  if (payload.event === "fdd_sent") {
    targetStatus = "fdd_sent";
    if (!lead.fdd_sent_at) patch.fdd_sent_at = eventAt;
  } else if (payload.event === "fdd_delivered") {
    targetStatus = "fdd_delivered";
    if (!lead.fdd_delivered_at) patch.fdd_delivered_at = eventAt;
  } else {
    targetStatus = "waiting_period_active";
    if (!lead.fdd_received_at) {
      patch.fdd_received_at = eventAt;
      patch.fdd_eligible_at = computeFddEligibleAt(eventAt);
    }
  }

  // Forward-only: a late 'delivered' after 'received' updates its timestamp
  // but never moves the status backwards. An errored lead recovers to the
  // event's status (e.g. manual document completion).
  if (fddStatusRank(targetStatus) > fddStatusRank(lead.fdd_status)) {
    patch.fdd_status = targetStatus;
    patch.fdd_last_error = null;
  }

  const updated = await store.updateLead(lead.id, patch);

  await store.insertFddAudit({
    lead_id: lead.id,
    event: payload.event,
    source: "webhook",
    actor: "system:webhook",
    external_event_id: externalEventId,
    ip_address: ip,
    before_values: { fdd_status: lead.fdd_status },
    after_values: {
      fdd_status: updated.fdd_status,
      envelope_id: updated.fdd_provider_envelope_id,
      event_at: eventAt,
    },
  });
  await trackEvent(updated, payload.event, { envelopeId: payload.envelope_id ?? null });

  // Advisor pipeline: mirror the FDD workflow's forward-only progress onto
  // the advisor stage. Never fires ahead of the webhook actually confirming
  // it, and autoAdvanceStage itself never regresses a manual stage.
  if (payload.event === "fdd_sent" && patch.fdd_status === "fdd_sent") {
    await autoAdvanceStage(updated, "FDD_SENT", "webhook_fdd");
  }

  if (payload.event === "fdd_received" && patch.fdd_received_at) {
    await store.insertFddAudit({
      lead_id: lead.id,
      event: "fdd_waiting_period_started",
      source: "webhook",
      actor: "system",
      after_values: {
        fdd_received_at: patch.fdd_received_at,
        fdd_eligible_at: patch.fdd_eligible_at,
      },
    });
    await trackEvent(updated, "fdd_waiting_period_started", {
      eligibleAt: patch.fdd_eligible_at,
    });

    await store.insertFddAudit({
      lead_id: lead.id,
      event: "fdd_advisor_notified",
      source: "webhook",
      actor: "system",
      after_values: { stage: "fdd_received" },
    });
    await trackEvent(updated, "fdd_advisor_notified", { stage: "fdd_received" });

    await autoAdvanceStage(updated, "FDD_ACKNOWLEDGED", "webhook_fdd");
  }

  return { ok: true, duplicate: false, httpStatus: 200, error: null };
}
