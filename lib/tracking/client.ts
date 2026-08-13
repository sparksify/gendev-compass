"use client";

/**
 * Browser-side half of the tracking contract. Server route handlers return
 * `{ eventId, dataLayerPayload, metaPixelBrowser }` (see TrackEventResult in
 * lib/portal/events.ts) alongside their normal JSON response; client
 * components call firePortalTrackingResults() with that payload so the
 * SAME event_id reaches both the dataLayer/Pixel (browser) and Meta CAPI
 * (server) — see docs/tracking-attribution.md, "GTM event contract".
 *
 * Never called with financial/questionnaire data — the server only ever
 * builds a DataLayerPayload from coarse, non-sensitive fields (spec §11).
 */

declare global {
  interface Window {
    dataLayer?: unknown[];
    fbq?: (...args: unknown[]) => void;
  }
}

export interface PortalTrackingResult {
  eventId: string;
  dataLayerPayload: Record<string, unknown> | null;
  metaPixelBrowser: { pixelId: string; eventName: string } | null;
}

export function pushToDataLayer(payload: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(payload);
}

/** Direct-mode Pixel fire only — never call this when GTM owns the Pixel tag (spec §2). */
export function fireMetaPixelDirect(pixelId: string, eventName: string, eventId: string): void {
  if (typeof window === "undefined") return;
  if (typeof window.fbq !== "function") return;
  window.fbq("track", eventName, {}, { eventID: eventId });
}

export function firePortalTrackingResults(results: Array<PortalTrackingResult | null | undefined>): void {
  for (const result of results) {
    if (!result) continue;
    if (result.dataLayerPayload) pushToDataLayer(result.dataLayerPayload);
    if (result.metaPixelBrowser) {
      fireMetaPixelDirect(result.metaPixelBrowser.pixelId, result.metaPixelBrowser.eventName, result.eventId);
    }
  }
}
