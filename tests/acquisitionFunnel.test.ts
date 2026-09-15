import { describe, expect, it } from "vitest";
import {
  buildRecentAcquisitionFunnel,
  isFacebookAttributed,
} from "@/lib/advisor/acquisitionFunnel";
import type { InvestorRow } from "@/lib/advisor/investors";
import type { PortalEventRecord } from "@/types/analytics";

function row(overrides: Record<string, unknown> = {}): InvestorRow {
  const lead = {
    id: "lead-1",
    created_at: "2026-09-15T12:00:00.000Z",
    source: "facebook",
    first_utm_source: null,
    facebook_lead_id: "fb-lead-1",
    facebook_campaign_id: null,
    facebook_adset_id: null,
    facebook_ad_id: null,
    first_fbclid: null,
    first_fbc: null,
    portal_first_opened_at: null,
    video_started_at: null,
    video_completed_at: null,
    booked_at: null,
    ...overrides,
  };
  return {
    lead,
    video: null,
    appointments: [],
  } as unknown as InvestorRow;
}

function event(leadId: string, eventName: string): PortalEventRecord {
  return {
    id: `${leadId}-${eventName}`,
    lead_id: leadId,
    event_name: eventName,
    event_data: null,
    page_url: null,
    event_source: "portal",
    created_by_staff_user_id: null,
    occurred_at: null,
    created_at: "2026-09-15T12:05:00.000Z",
  };
}

describe("recent acquisition funnel", () => {
  it("distinguishes a play at zero percent from no start", () => {
    const started = row({ video_started_at: "2026-09-15T12:05:00.000Z" });
    const funnel = buildRecentAcquisitionFunnel(
      [started],
      new Map([["lead-1", [event("lead-1", "video_started")]]]),
      new Date("2026-09-15T13:00:00.000Z"),
    );

    expect(funnel.videoStarted).toBe(1);
    expect(funnel.measurableVideo).toBe(0);
  });

  it("surfaces direct portal handoffs that skipped the bridge", () => {
    const opened = row({ portal_first_opened_at: "2026-09-15T12:05:00.000Z" });
    const funnel = buildRecentAcquisitionFunnel(
      [opened],
      new Map([["lead-1", [event("lead-1", "portal_opened")]]]),
      new Date("2026-09-15T13:00:00.000Z"),
    );

    expect(funnel.portalOpened).toBe(1);
    expect(funnel.bridgeOpened).toBe(0);
    expect(funnel.portalWithoutBridge).toBe(1);
  });

  it("recognizes Facebook attribution from provider IDs or source fields", () => {
    expect(isFacebookAttributed(row())).toBe(true);
    expect(isFacebookAttributed(row({ facebook_lead_id: null, source: "facebook-lead-ad" }))).toBe(
      true,
    );
    expect(
      isFacebookAttributed(
        row({ facebook_lead_id: null, source: "crm", first_utm_source: "meta" }),
      ),
    ).toBe(true);
    expect(
      isFacebookAttributed(
        row({ facebook_lead_id: null, source: "organic", first_utm_source: null }),
      ),
    ).toBe(false);
  });
});
