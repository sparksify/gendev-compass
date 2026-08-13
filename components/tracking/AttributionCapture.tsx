"use client";

import { useEffect, useRef } from "react";

interface AttributionCaptureProps {
  token: string;
}

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Fires once per portal page load: captures the current URL's UTM/click-ID
 * params plus document.referrer and the Meta browser/click-ID cookies
 * (_fbp/_fbc, set by the Pixel when it's running) and sends them to the
 * server to record first/last-touch attribution (spec §4). Runs client-side
 * — not server layout — specifically so it can read cookies the Pixel sets,
 * which server components never see on the very first navigation.
 */
export function AttributionCapture({ token }: AttributionCaptureProps) {
  const sentRef = useRef(false);

  useEffect(() => {
    if (sentRef.current) return;
    sentRef.current = true;

    const payload = {
      url: window.location.href,
      referrer: document.referrer || null,
      fbp: readCookie("_fbp"),
      fbc: readCookie("_fbc"),
    };

    // Nothing in the URL/cookies to capture — skip the request entirely.
    if (!window.location.search && !payload.referrer && !payload.fbp && !payload.fbc) return;

    void fetch(`/api/portal/${token}/attribution`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => undefined);
  }, [token]);

  return null;
}
