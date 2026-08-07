"use client";

import { useEffect, useRef } from "react";
import { firePortalTrackingResults, type PortalTrackingResult } from "@/lib/tracking/client";

/**
 * Fires a server-computed tracking result (dataLayer push / direct Pixel)
 * on mount — for events recorded during server rendering (e.g.
 * portal_opened, fired once in lib/portal/context.ts) that have no fetch
 * response for a client component to hook into.
 */
export function PortalEventFirer({ result }: { result: PortalTrackingResult | null }) {
  const firedRef = useRef(false);

  useEffect(() => {
    if (!result || firedRef.current) return;
    firedRef.current = true;
    firePortalTrackingResults([result]);
  }, [result]);

  return null;
}
