import type { PortalEventName } from "@/types/analytics";

/**
 * The canonical internal → external event mapping (spec §6-§8 of
 * docs/tracking-attribution.md). This is the coded default; an admin can
 * override provider toggles and the Meta event name per event from
 * /admin/tracking without a deploy (tracking_settings.event_overrides).
 *
 * Business-importance tier (spec §8): 1 = primary conversion (optimize
 * campaigns around this), 2 = qualified conversion, 3 = qualification
 * progress, 4 = engagement (do not optimize spend on tier-4 volume alone).
 */
export type ConversionTier = 1 | 2 | 3 | 4;

export interface EventTaxonomyEntry {
  tier: ConversionTier;
  /** Meta standard/custom event name, or null to never send this event to Meta. */
  metaEventName: string | null;
  gtm: boolean;
  metaBrowser: boolean;
  metaCapi: boolean;
}

export const EVENT_TAXONOMY: Partial<Record<PortalEventName, EventTaxonomyEntry>> = {
  lead_created: { tier: 4, metaEventName: null, gtm: false, metaBrowser: false, metaCapi: false },

  portal_opened: { tier: 4, metaEventName: "ViewContent", gtm: true, metaBrowser: true, metaCapi: false },
  portal_returned: { tier: 4, metaEventName: null, gtm: true, metaBrowser: false, metaCapi: false },

  video_started: {
    tier: 4,
    metaEventName: "InvestorOverviewStarted",
    gtm: true,
    metaBrowser: true,
    metaCapi: false,
  },
  video_progress_25: { tier: 4, metaEventName: null, gtm: true, metaBrowser: false, metaCapi: false },
  video_progress_50: { tier: 4, metaEventName: null, gtm: true, metaBrowser: false, metaCapi: false },
  video_progress_75: { tier: 4, metaEventName: null, gtm: true, metaBrowser: false, metaCapi: false },
  video_completion_threshold_reached: {
    tier: 3,
    metaEventName: "InvestorOverviewCompleted",
    gtm: true,
    metaBrowser: true,
    metaCapi: true,
  },

  questionnaire_started: {
    tier: 4,
    metaEventName: "QualificationStarted",
    gtm: true,
    metaBrowser: true,
    metaCapi: false,
  },
  // Internal name is "questionnaire_submitted" (types/analytics.ts); this is
  // the spec's "questionnaire_completed" conversion.
  questionnaire_submitted: {
    tier: 3,
    metaEventName: "CompleteRegistration",
    gtm: true,
    metaBrowser: true,
    metaCapi: true,
  },

  lead_qualified: { tier: 2, metaEventName: "Lead", gtm: true, metaBrowser: true, metaCapi: true },
  lead_sent_to_review: { tier: 4, metaEventName: null, gtm: true, metaBrowser: false, metaCapi: false },

  calendar_opened: {
    tier: 3,
    metaEventName: "ConsultationUnlocked",
    gtm: true,
    metaBrowser: true,
    metaCapi: false,
  },
  // appointment_booked is the single canonical event mapped to Meta's
  // "Schedule" (spec §7). calendar_booking_completed fires alongside it
  // (same event_id, see the booking route) purely for internal timeline
  // detail — it intentionally does NOT map to Meta, or "Schedule" would be
  // double-counted for one booking.
  appointment_booked: { tier: 1, metaEventName: "Schedule", gtm: true, metaBrowser: true, metaCapi: true },
  calendar_booking_completed: { tier: 1, metaEventName: null, gtm: true, metaBrowser: false, metaCapi: false },

  portal_completed: { tier: 4, metaEventName: "PortalCompleted", gtm: true, metaBrowser: false, metaCapi: false },
  resource_viewed: { tier: 4, metaEventName: null, gtm: true, metaBrowser: false, metaCapi: false },
  resource_downloaded: { tier: 4, metaEventName: null, gtm: true, metaBrowser: false, metaCapi: false },
};

export function taxonomyFor(eventName: PortalEventName): EventTaxonomyEntry | null {
  return EVENT_TAXONOMY[eventName] ?? null;
}
