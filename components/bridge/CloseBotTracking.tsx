import React from "react";
import Script from "next/script";
import { getEffectiveTrackingSettings } from "@/lib/tracking/settings";
import { marketingAllowed, readConsentCookie } from "@/lib/tracking/consent";

/** CloseBot is confined to the acquisition bridge, never the advisor or private portal. */
export async function CloseBotTracking() {
  try {
    const settings = await getEffectiveTrackingSettings();
    const consent = await readConsentCookie();
    if (!marketingAllowed(settings.consentRequired, consent, settings.marketingTrackingDefault)) {
      return null;
    }
  } catch {
    // A settings failure must not block the bridge or accidentally bypass consent.
    return null;
  }

  return (
    <Script
      id="closebot-bridge"
      src="https://api.closebot.com/scripts/cb.js?source=ZpC5XwuqOJVlUXWU"
      strategy="afterInteractive"
    />
  );
}
