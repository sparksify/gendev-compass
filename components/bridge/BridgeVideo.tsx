"use client";

import { useEffect, useState } from "react";

/**
 * Plain Wistia embed for the bridge page. Same <wistia-player> web
 * component the portal uses (see components/portal/WistiaPlayer.tsx, which
 * also declares the JSX intrinsic element), minus the server-tracked
 * progress: the bridge has no lead to attribute watch time to.
 */
export function BridgeVideo({ mediaId }: { mediaId: string | null }) {
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!mediaId) return;
    const ensureScript = (src: string, type?: string) => {
      if (document.querySelector(`script[src="${src}"]`)) return;
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      if (type) script.type = type;
      script.onerror = () => setLoadError(true);
      document.head.appendChild(script);
    };
    ensureScript("https://fast.wistia.com/player.js");
    ensureScript(`https://fast.wistia.com/embed/${mediaId}.js`, "module");
  }, [mediaId]);

  if (!mediaId) {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center rounded-[6px] border border-dashed border-border bg-surface p-6 text-center">
        <p className="text-sm font-medium text-foreground">Video not configured</p>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          Set <code className="rounded bg-white px-1">NEXT_PUBLIC_BRIDGE_WISTIA_MEDIA_ID</code> to
          the bridge video&rsquo;s Wistia media ID.
        </p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center rounded-[6px] border border-border bg-surface p-6 text-center">
        <p className="text-sm font-medium text-foreground">We were unable to load the video.</p>
        <p className="mt-2 text-sm text-muted-foreground">Please refresh the page to try again.</p>
      </div>
    );
  }

  return <wistia-player media-id={mediaId} />;
}
