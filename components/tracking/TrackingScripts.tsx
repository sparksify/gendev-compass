"use client";

import Script from "next/script";
import type { PublicTrackingConfig } from "@/lib/tracking/settings";

interface TrackingScriptsProps {
  config: PublicTrackingConfig;
  marketingAllowed: boolean;
}

/**
 * Site-wide GTM + (optional) direct Meta Pixel bootstrap. Rendered once from
 * the root layout — admin changes in /admin/tracking take effect on the
 * next page load with no code change (spec §3-A, acceptance criteria #1-2).
 *
 * Mutually exclusive by construction (spec §2): GTM's Meta Pixel tag and
 * this component's direct Pixel init never both fire — meta_browser_mode is
 * a single enum, so only one code path below can be active per deployment.
 */
export function TrackingScripts({ config, marketingAllowed }: TrackingScriptsProps) {
  const showDirectPixel =
    config.metaEnabled && config.metaBrowserMode === "direct" && marketingAllowed && Boolean(config.metaPixelId);

  return (
    <>
      {config.gtmEnabled && config.gtmContainerId && (
        <>
          <Script id="gtm-init" strategy="afterInteractive">
            {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${config.gtmContainerId}');`}
          </Script>
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${config.gtmContainerId}`}
              height="0"
              width="0"
              style={{ display: "none", visibility: "hidden" }}
              title="Google Tag Manager"
            />
          </noscript>
        </>
      )}

      {showDirectPixel && (
        <>
          <Script id="meta-pixel-init" strategy="afterInteractive">
            {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${config.metaPixelId}');fbq('track','PageView');`}
          </Script>
          <noscript>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              height="1"
              width="1"
              style={{ display: "none" }}
              alt=""
              src={`https://www.facebook.com/tr?id=${config.metaPixelId}&ev=PageView&noscript=1`}
            />
          </noscript>
        </>
      )}
    </>
  );
}
