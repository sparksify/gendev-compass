"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Wistia's current embed method is the <wistia-player> web component,
 * loaded from fast.wistia.com/player.js plus a per-media module
 * (verified against the published @wistia/wistia-player package: events
 * `api-ready`, `play`, `pause`, `ended`, `time-update`; properties
 * `currentTime`, `duration`, `percentWatched`, `secondsWatched`).
 *
 * Progress is reported to the server, which alone decides completion.
 */

interface WistiaPlayerElement extends HTMLElement {
  currentTime: number;
  duration: number;
  /** Fraction of the media watched (unique), 0–1. */
  percentWatched: number;
  /** Unique seconds of the media watched. */
  secondsWatched: number;
  ended: boolean;
}

declare module "react" {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      "wistia-player": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        "media-id"?: string;
      };
    }
  }
}

interface WistiaPlayerProps {
  mediaId: string | null;
  token: string;
  initialPercent: number;
  initialCompleted: boolean;
  resumePosition: number;
  completionThreshold: number;
}

const REPORT_INTERVAL_MS = 10_000;

export function WistiaPlayer({
  mediaId,
  token,
  initialPercent,
  initialCompleted,
  resumePosition,
  completionThreshold,
}: WistiaPlayerProps) {
  const router = useRouter();
  const playerRef = useRef<WistiaPlayerElement | null>(null);
  const resumedRef = useRef(false);
  const completedRef = useRef(initialCompleted);
  const [percent, setPercent] = useState(initialPercent);
  const [completed, setCompleted] = useState(initialCompleted);
  const [loadError, setLoadError] = useState(false);

  const report = useCallback(
    async (eventType: "play" | "timeupdate" | "pause" | "ended" | "heartbeat") => {
      const player = playerRef.current;
      if (!player || completedRef.current) return;
      const duration = Number(player.duration) || 0;
      const currentTime = Number(player.currentTime) || 0;
      if (duration <= 0) return;

      const rawUnique = Number(player.percentWatched);
      const uniqueFraction = Number.isFinite(rawUnique) ? Math.min(Math.max(rawUnique, 0), 1) : 0;
      const positionPercent = Math.min(100, (currentTime / duration) * 100);
      const secondsWatched = Number(player.secondsWatched) || uniqueFraction * duration;

      try {
        const response = await fetch(`/api/portal/${token}/video-progress`, {
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
        });
        if (!response.ok) return;
        const data = (await response.json()) as { completed?: boolean; highestPercent?: number };
        if (typeof data.highestPercent === "number") {
          setPercent(Math.round(data.highestPercent));
        }
        if (data.completed && !completedRef.current) {
          completedRef.current = true;
          setCompleted(true);
          router.refresh();
        }
      } catch {
        // Network hiccups are fine — the next heartbeat retries.
      }
    },
    [mediaId, token, router],
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

    const onApiReady = () => {
      if (!resumedRef.current && resumePosition > 5 && !completedRef.current) {
        resumedRef.current = true;
        try {
          player.currentTime = resumePosition;
        } catch {
          // Resume is best-effort.
        }
      }
    };
    const onPlay = () => void report("play");
    const onPause = () => void report("pause");
    const onEnded = () => void report("ended");

    player.addEventListener("api-ready", onApiReady);
    player.addEventListener("play", onPlay);
    player.addEventListener("pause", onPause);
    player.addEventListener("ended", onEnded);

    const interval = window.setInterval(() => {
      const p = playerRef.current;
      if (!p || completedRef.current) return;
      // Only report while actually advancing (i.e. playing).
      if (Number(p.duration) > 0 && !p.ended) {
        void report("heartbeat");
      }
    }, REPORT_INTERVAL_MS);

    return () => {
      player.removeEventListener("api-ready", onApiReady);
      player.removeEventListener("play", onPlay);
      player.removeEventListener("pause", onPause);
      player.removeEventListener("ended", onEnded);
      window.clearInterval(interval);
    };
  }, [mediaId, report, resumePosition]);

  if (!mediaId) {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center rounded-xl border border-dashed border-line bg-white p-6 text-center">
        <p className="text-sm font-medium text-ink">Video not configured</p>
        <p className="mt-2 max-w-sm text-sm text-ink-muted">
          Set <code className="rounded bg-surface px-1">NEXT_PUBLIC_WISTIA_MEDIA_ID</code> to embed
          the investor overview. In development you can use the simulation control below to test the
          flow.
        </p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center rounded-xl border border-line bg-white p-6 text-center">
        <p className="text-sm font-medium text-ink">We were unable to load the investor overview.</p>
        <p className="mt-2 text-sm text-ink-muted">
          Please refresh the page. If the problem continues, contact our team.
        </p>
      </div>
    );
  }

  return (
    <div>
      <wistia-player
        media-id={mediaId}
        ref={(el: HTMLElement | null) => {
          playerRef.current = el as WistiaPlayerElement | null;
        }}
      />
      <p className="mt-3 text-sm text-ink-muted" aria-live="polite">
        Overview Progress: <span className="font-semibold text-ink">{completed ? 100 : percent}%</span>
        {!completed && (
          <span className="ml-2 text-xs">
            (unlocks at {completionThreshold}%)
          </span>
        )}
      </p>
    </div>
  );
}
