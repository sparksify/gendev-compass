import { getStore } from "@/lib/store";
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

  if (!lead.organization_id) return;

  let actorProfileId = options.actorProfileId ?? null;
  if (!actorProfileId && options.staffUserId) {
    const profile = await store.getProfileByLegacyStaffUserId(options.staffUserId);
    actorProfileId = profile?.id ?? null;
  }

  await store.insertActivityEvent({
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
