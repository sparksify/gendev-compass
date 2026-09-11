"use client";

import { useEffect, useRef, useState } from "react";
import { pushToDataLayer } from "@/lib/tracking/client";
import { useBridgeVideo } from "./BridgeVideoContext";

/**
 * Wistia embed for the bridge page. Same <wistia-player> web component the
 * portal uses (components/portal/WistiaPlayer.tsx also declares the JSX
 * intrinsic element). There is no lead yet, so watch progress is kept in
 * the browser (BridgeVideoContext) and attached to the assessment when it
 * is submitted; start/complete also go to the GTM dataLayer.
 */

interface WistiaPlayerElement extends HTMLElement {
  percentWatched: number;
  ended: boolean;
}

const SAMPLE_INTERVAL_MS = 5_000;

export function BridgeVideo({ mediaId }: { mediaId: string | null }) {
  const [loadError, setLoadError] = useState(false);
  const playerRef = useRef<WistiaPlayerElement | null>(null);
  const { report } = useBridgeVideo();

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

    const player = playerRef.current;
    if (!player) return;

    const sample = () => {
      const raw = Number(player.percentWatched);
      if (Number.isFinite(raw) && raw > 0) report({ percent: Math.round(Math.min(raw, 1) * 100) });
    };
    let startedFired = false;
    const onPlay = () => {
      if (!startedFired) {
        startedFired = true;
        report({ started: true });
        pushToDataLayer({ event: "bridge_video_started", media_id: mediaId });
      }
    };
    const onPause = sample;
    const onEnded = () => {
      report({ percent: 100 });
      pushToDataLayer({ event: "bridge_video_completed", media_id: mediaId });
    };

    player.addEventListener("play", onPlay);
    player.addEventListener("pause", onPause);
    player.addEventListener("ended", onEnded);
    const interval = window.setInterval(sample, SAMPLE_INTERVAL_MS);

    return () => {
      player.removeEventListener("play", onPlay);
      player.removeEventListener("pause", onPause);
      player.removeEventListener("ended", onEnded);
      window.clearInterval(interval);
    };
  }, [mediaId, report]);

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

  return (
    <wistia-player
      media-id={mediaId}
      ref={(el: HTMLElement | null) => {
        playerRef.current = el as WistiaPlayerElement | null;
      }}
    />
  );
}
