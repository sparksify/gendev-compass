"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { pushToDataLayer } from "@/lib/tracking/client";
import { useBridgeVideo } from "./BridgeVideoContext";

/**
 * Wistia embed for the bridge page. Same <wistia-player> web component the
 * portal uses (components/portal/WistiaPlayer.tsx also declares the JSX
 * intrinsic element) and the same reporting rhythm: play / pause / ended
 * plus a heartbeat every 10 seconds of playback.
 *
 * With a lead token (from the URL, or once an anonymous assessment creates
 * the lead) every report goes to /api/bridge/[token]/video-progress, where
 * the server records start, 25/50/75, stops, and completion on the lead's
 * tracked history. Without one, progress is kept in the browser and
 * attached to the assessment when it is submitted.
 */

interface WistiaPlayerElement extends HTMLElement {
  currentTime: number;
  duration: number;
  percentWatched: number;
  secondsWatched: number;
  ended: boolean;
}

const REPORT_INTERVAL_MS = 10_000;

export function BridgeVideo({ mediaId }: { mediaId: string | null }) {
  const [loadError, setLoadError] = useState(false);
  const playerRef = useRef<WistiaPlayerElement | null>(null);
  const { report, token } = useBridgeVideo();
  const tokenRef = useRef(token);
  tokenRef.current = token;

  const sendProgress = useCallback(
    async (eventType: "play" | "pause" | "ended" | "heartbeat") => {
      const player = playerRef.current;
      const currentToken = tokenRef.current;
      if (!player) return;

      const duration = Number(player.duration) || 0;
      const currentTime = Number(player.currentTime) || 0;
      const rawUnique = Number(player.percentWatched);
      const uniqueFraction = Number.isFinite(rawUnique) ? Math.min(Math.max(rawUnique, 0), 1) : 0;
      if (uniqueFraction > 0) report({ percent: Math.round(uniqueFraction * 100) });
      if (!currentToken || duration <= 0) return;

      const positionPercent = Math.min(100, (currentTime / duration) * 100);
      const secondsWatched = Number(player.secondsWatched) || uniqueFraction * duration;
      try {
        await fetch(`/api/bridge/${currentToken}/video-progress`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            currentTime,
            duration,
            percent: Math.round(positionPercent * 100) / 100,
            secondsWatched: Math.round(secondsWatched),
            eventType,
            mediaId: mediaId ?? undefined,
          }),
          keepalive: eventType !== "heartbeat",
        });
      } catch {
        // Network hiccups are fine — the next report retries.
      }
    },
    [mediaId, report],
  );

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

    let startedFired = false;
    const onPlay = () => {
      if (!startedFired) {
        startedFired = true;
        report({ started: true });
        pushToDataLayer({ event: "bridge_video_started", media_id: mediaId });
      }
      void sendProgress("play");
    };
    const onPause = () => void sendProgress("pause");
    const onEnded = () => {
      report({ percent: 100 });
      pushToDataLayer({ event: "bridge_video_completed", media_id: mediaId });
      void sendProgress("ended");
    };

    player.addEventListener("play", onPlay);
    player.addEventListener("pause", onPause);
    player.addEventListener("ended", onEnded);

    const interval = window.setInterval(() => {
      const p = playerRef.current;
      // Only report while actually advancing (i.e. playing).
      if (p && Number(p.duration) > 0 && !p.ended) void sendProgress("heartbeat");
    }, REPORT_INTERVAL_MS);

    return () => {
      player.removeEventListener("play", onPlay);
      player.removeEventListener("pause", onPause);
      player.removeEventListener("ended", onEnded);
      window.clearInterval(interval);
    };
  }, [mediaId, report, sendProgress]);

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
