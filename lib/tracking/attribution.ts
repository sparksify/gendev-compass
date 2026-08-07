import type { LeadPatch } from "@/lib/store/types";

/**
 * UTM / click-ID / Meta cookie attribution capture (spec §4). First-touch
 * fields are written once and never overwritten; last-touch fields may
 * update on later "qualified" visits — a visit that actually carries a new
 * attribution signal, not every page view.
 */

export interface AttributionSignal {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  fbclid: string | null;
  gclid: string | null;
  msclkid: string | null;
  fbp: string | null;
  fbc: string | null;
  referrer: string | null;
  landing_page: string | null;
}

const EMPTY_SIGNAL: AttributionSignal = {
  utm_source: null,
  utm_medium: null,
  utm_campaign: null,
  utm_content: null,
  utm_term: null,
  fbclid: null,
  gclid: null,
  msclkid: null,
  fbp: null,
  fbc: null,
  referrer: null,
  landing_page: null,
};

/** Parses a full URL string (query params) into an attribution signal. landingPage is the URL with the query string stripped. */
export function parseAttributionFromUrl(
  urlString: string,
  extra: { referrer?: string | null; fbp?: string | null; fbc?: string | null } = {},
): AttributionSignal {
  let params: URLSearchParams;
  let landingPage: string | null = null;
  try {
    const url = new URL(urlString);
    // Snapshot the params before mutating url.search — url.searchParams is
    // a live view tied to the URL and clearing url.search empties it too.
    params = new URLSearchParams(url.search);
    url.search = "";
    url.hash = "";
    landingPage = url.toString();
  } catch {
    params = new URLSearchParams();
  }

  return {
    utm_source: sanitize(params.get("utm_source")),
    utm_medium: sanitize(params.get("utm_medium")),
    utm_campaign: sanitize(params.get("utm_campaign")),
    utm_content: sanitize(params.get("utm_content")),
    utm_term: sanitize(params.get("utm_term")),
    fbclid: sanitize(params.get("fbclid")),
    gclid: sanitize(params.get("gclid")),
    msclkid: sanitize(params.get("msclkid")),
    fbp: sanitize(extra.fbp ?? null),
    fbc: sanitize(extra.fbc ?? null),
    referrer: sanitize(extra.referrer ?? null),
    landing_page: landingPage,
  };
}

function sanitize(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim().slice(0, 500);
  return trimmed.length > 0 ? trimmed : null;
}

/** Whether this signal carries an actual attribution touch (not just a bare page view). */
export function hasQualifiedTouch(signal: AttributionSignal): boolean {
  return Boolean(
    signal.utm_source ||
      signal.utm_medium ||
      signal.utm_campaign ||
      signal.fbclid ||
      signal.gclid ||
      signal.msclkid,
  );
}

export function hasAnySignal(signal: AttributionSignal): boolean {
  return Object.values(signal).some((v) => v !== null);
}

/** Builds the leads.create first-touch column set from a signal. */
export function buildFirstTouchFields(signal: AttributionSignal, nowIso: string) {
  return {
    first_utm_source: signal.utm_source,
    first_utm_medium: signal.utm_medium,
    first_utm_campaign: signal.utm_campaign,
    first_utm_content: signal.utm_content,
    first_utm_term: signal.utm_term,
    first_fbclid: signal.fbclid,
    first_gclid: signal.gclid,
    first_msclkid: signal.msclkid,
    first_fbp: signal.fbp,
    first_fbc: signal.fbc,
    first_referrer: signal.referrer,
    first_landing_page: signal.landing_page,
    first_touch_at: nowIso,
  };
}

/** Builds a LeadPatch that updates only latest-touch columns. */
export function buildLastTouchPatch(signal: AttributionSignal, nowIso: string): LeadPatch {
  return {
    last_utm_source: signal.utm_source,
    last_utm_medium: signal.utm_medium,
    last_utm_campaign: signal.utm_campaign,
    last_utm_content: signal.utm_content,
    last_utm_term: signal.utm_term,
    last_fbclid: signal.fbclid,
    last_referrer: signal.referrer,
    last_landing_page: signal.landing_page,
    last_touch_at: nowIso,
  };
}

export { EMPTY_SIGNAL };
