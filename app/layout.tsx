import type { Metadata, Viewport } from "next";
import { brand } from "@/lib/config/brand";
import { getEffectiveTrackingSettings, toPublicConfig } from "@/lib/tracking/settings";
import { marketingAllowed, readConsentCookie } from "@/lib/tracking/consent";
import { TrackingScripts } from "@/components/tracking/TrackingScripts";
import { ConsentBanner } from "@/components/tracking/ConsentBanner";
import "@fontsource-variable/dm-sans";
import "@fontsource-variable/plus-jakarta-sans";
import "@fontsource-variable/source-serif-4";
import "./globals.css";

export const metadata: Metadata = {
  title: `${brand.productName} — ${brand.portalLabel}`,
  description: "Private investor qualification portal.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Tracking must never break the site — any failure here (e.g. Supabase
  // unreachable) falls back to "nothing enabled" rather than a 500.
  let trackingConfig = null as ReturnType<typeof toPublicConfig> | null;
  let allowMarketing = false;
  let consentRequired = false;
  let alreadyDecided = false;
  try {
    const settings = await getEffectiveTrackingSettings();
    trackingConfig = toPublicConfig(settings);
    consentRequired = settings.consentRequired;
    const consent = await readConsentCookie();
    allowMarketing = marketingAllowed(settings.consentRequired, consent, settings.marketingTrackingDefault);
    alreadyDecided = consent !== null;
  } catch (error) {
    console.error("[tracking] failed to load tracking settings — tracking disabled for this render:", error);
  }

  return (
    <html lang="en">
      <body className="min-h-screen">
        {trackingConfig && <TrackingScripts config={trackingConfig} marketingAllowed={allowMarketing} />}
        {children}
        <ConsentBanner required={consentRequired} alreadyDecided={alreadyDecided} />
      </body>
    </html>
  );
}
