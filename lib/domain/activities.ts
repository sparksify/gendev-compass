import { getStore } from "@/lib/store";
import { dispatchNotificationsForEvent } from "@/lib/notifications/dispatch";
import type { LeadRecord } from "@/types/lead";
import type { ActivityEventRecord } from "@/types/domain";

/**
 * Centralized event recording.
 *
 * Transition behavior (documented in migration-compatibility-plan.md):
 * every lead-scoped event is written to BOTH stores in one call —
 * portal_events (the legacy table all current screens read) and
 * activity_events (the generalized timeline). This is the only place that
 * dual-write happens; route handlers and services never insert raw events
 * themselves.
 *
 * A lead whose domain chain has not been created yet (pre-backfill rows in
 * environments that have not run migration 0006) only gets the
 * portal_events row — rerunning the backfill copies those over via
 * legacy_portal_event_id, so nothing is lost.
 */

export interface RecordLeadEventOptions {
  /** portal | staff | webhook_calendar | webhook_fdd | system … */
  source?: string;
  staffUserId?: string | null;
  actorProfileId?: string | null;
  /** Provider-supplied event ID for replay detection. */
  externalEventId?: string | null;
  /** Provider-supplied timestamp; defaults to now. */
  occurredAt?: string | null;
}

export async function recordLeadEvent(
  lead: LeadRecord,
  eventName: string,
  eventData: Record<string, unknown> | null,
  pageUrl: string | null = null,
  options: RecordLeadEventOptions = {},
): Promise<void> {
  const store = getStore();
  const source = options.source ?? "portal";

  // Legacy table first — this is what the current dashboard reads and its
  // write path must never be broken by the new table.
  await store.insertEvent(lead.id, eventName, eventData, pageUrl, {
    source,
    staffUserId: options.staffUserId ?? null,
    occurredAt: options.occurredAt ?? null,
  });

  let activityEventId: string | null = null;

  if (lead.organization_id) {
    let actorProfileId = options.actorProfileId ?? null;
    if (!actorProfileId && options.staffUserId) {
      const profile = await store.getProfileByLegacyStaffUserId(options.staffUserId);
      actorProfileId = profile?.id ?? null;
    }

    const activityEvent = await store.insertActivityEvent({
      organization_id: lead.organization_id,
      client_id: lead.client_id,
      lead_id: lead.id,
      opportunity_id: lead.primary_opportunity_id,
      actor_profile_id: actorProfileId,
      event_type: eventName,
      event_source: source,
      event_data: eventData ?? {},
      page_url: pageUrl,
      external_event_id: options.externalEventId ?? null,
      occurred_at: options.occurredAt ?? undefined,
    });

    // A provider-supplied event that inserts nothing was dropped by the
    // replay guard: it is a redelivery of something already handled, and
    // notifying on it would defeat that guard.
    if (!activityEvent && options.externalEventId) return;

    activityEventId = activityEvent?.id ?? null;
  }

  // Stage three of the pipeline, deliberately outside the organization_id
  // check above: a lead whose domain chain has not been backfilled yet still
  // has a real advisor who needs to hear about a completed questionnaire.
  // Policy lives entirely in lib/notifications/rules.ts — almost every event
  // is dashboard-only and returns immediately. This never throws.
  await dispatchNotificationsForEvent({ lead, eventName, eventData, activityEventId });
}

/** Opportunity timeline, newest first (occurred_at ordering). */
export async function listOpportunityTimeline(
  opportunityId: string,
): Promise<ActivityEventRecord[]> {
  return getStore().listActivityForOpportunity(opportunityId);
}

/** Client timeline across all of the client's opportunities, newest first. */
export async function listClientTimeline(clientId: string): Promise<ActivityEventRecord[]> {
  return getStore().listActivityForClient(clientId);
}

/** Replay guard for provider-delivered events. */
export async function hasExternalEvent(
  organizationId: string,
  eventSource: string,
  externalEventId: string,
): Promise<boolean> {
  return getStore().hasActivityExternalEvent(organizationId, eventSource, externalEventId);
}
