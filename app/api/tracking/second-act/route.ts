import { getEffectiveTrackingSettings } from "@/lib/tracking/settings";
import { marketingAllowed, readConsentCookie } from "@/lib/tracking/consent";

export const dynamic = "force-dynamic";

/** Tracking for the static advertorial, which bypasses the Next.js layout. */
export async function GET(): Promise<Response> {
  let script = "/* Advertorial tracking disabled. */";
  try {
    const settings = await getEffectiveTrackingSettings();
    const consent = await readConsentCookie();
    const allowed = marketingAllowed(
      settings.consentRequired,
      consent,
      settings.marketingTrackingDefault,
    );

    if (allowed) {
      script = `(function(){
  if (document.querySelector('script[data-gdc-closebot]')) return;
  var tag = document.createElement('script');
  tag.src = 'https://api.closebot.com/scripts/cb.js?source=ZpC5XwuqOJVlUXWU';
  tag.async = true;
  tag.dataset.gdcClosebot = '';
  document.head.appendChild(tag);
})();`;
    }

    if (
      allowed && settings.metaEnabled && settings.metaBrowserMode === "direct" &&
      settings.metaPixelId && /^\d+$/.test(settings.metaPixelId)
    ) {
      const pixelId = JSON.stringify(settings.metaPixelId);
      script += `\n(function(){
  if (window.__gdcSecondActPixelSent) return;
  window.__gdcSecondActPixelSent = true;
  !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
  fbq('init',${pixelId});
  fbq('track','PageView');
  fbq('track','ViewContent',{content_name:'The Second Act Report - CMDT advertorial',content_category:'advertorial'});
})();`;
    }
  } catch {
    // Tracking failures must neither break the article nor bypass consent.
  }

  return new Response(script, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "private, no-store",
      "Vary": "Cookie",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
