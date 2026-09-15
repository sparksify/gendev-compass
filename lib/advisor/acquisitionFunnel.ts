import type { PortalEventRecord } from "@/types/analytics";
import type { InvestorRow } from "@/lib/advisor/investors";

export interface RecentAcquisitionFunnel {
  windowHours: number;
  newLeads: number;
  facebookAttributed: number;
  bridgeOpened: number;
  portalOpened: number;
  portalWithoutBridge: number;
  videoStarted: number;
  measurableVideo: number;
  videoCompleted: number;
  booked: number;
}

function hasEvent(events: PortalEventRecord[], name: string): boolean {
  return events.some((event) => event.event_name === name);
}

export function isFacebookAttributed(row: InvestorRow): boolean {
  const { lead } = row;
  const source = `${lead.source ?? ""} ${lead.first_utm_source ?? ""}`.toLowerCase();
  return Boolean(
    lead.facebook_lead_id ||
      lead.facebook_campaign_id ||
      lead.facebook_adset_id ||
      lead.facebook_ad_id ||
      lead.first_fbclid ||
      lead.first_fbc ||
      /\b(facebook|meta|fb)\b/.test(source),
  );
}

/**
 * A lead-level view of the first 24 hours of the ad handoff. Counts are
 * independent milestones, not an invented strictly-nested funnel: this is
 * important while older automations can still send people directly to /p.
 */
export function buildRecentAcquisitionFunnel(
  rows: InvestorRow[],
  eventsByLead: ReadonlyMap<string, PortalEventRecord[]>,
  now: Date = new Date(),
  windowHours = 24,
): RecentAcquisitionFunnel {
  const cutoff = now.getTime() - windowHours * 3_600_000;
  const recent = rows.filter((row) => new Date(row.lead.created_at).getTime() >= cutoff);

  let facebookAttributed = 0;
  let bridgeOpened = 0;
  let portalOpened = 0;
  let portalWithoutBridge = 0;
  let videoStarted = 0;
  let measurableVideo = 0;
  let videoCompleted = 0;
  let booked = 0;

  for (const row of recent) {
    const events = eventsByLead.get(row.lead.id) ?? [];
    const bridge = hasEvent(events, "bridge_opened");
    const portal = Boolean(row.lead.portal_first_opened_at) || hasEvent(events, "portal_opened");
    const started =
      Boolean(row.lead.video_started_at) ||
      Boolean(row.video?.started) ||
      hasEvent(events, "video_started");
    const completed =
      Boolean(row.lead.video_completed_at) ||
      Boolean(row.video?.completed) ||
      hasEvent(events, "video_completion_threshold_reached");

    if (isFacebookAttributed(row)) facebookAttributed += 1;
    if (bridge) bridgeOpened += 1;
    if (portal) portalOpened += 1;
    if (portal && !bridge) portalWithoutBridge += 1;
    if (started) videoStarted += 1;
    if ((row.video?.highest_percent_watched ?? 0) > 0) measurableVideo += 1;
    if (completed) videoCompleted += 1;
    if (row.lead.booked_at || row.appointments.length > 0) booked += 1;
  }

  return {
    windowHours,
    newLeads: recent.length,
    facebookAttributed,
    bridgeOpened,
    portalOpened,
    portalWithoutBridge,
    videoStarted,
    measurableVideo,
    videoCompleted,
    booked,
  };
}
