import { Play } from "lucide-react";
import { SIGNAL, DISCOVERY_STAGES } from "@/lib/advisor/discoveryStages";

/** Watch-percent color coding: finished is green, healthy progress teal,
 * a stalled early exit amber (handoff: "Video-watch color coding"). */
export function watchColor(percent: number, completed: boolean): string {
  if (completed || percent >= 100) return SIGNAL.success;
  if (percent >= 50) return DISCOVERY_STAGES[0].color;
  return SIGNAL.warning;
}

const RADIUS = 11;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * The clients-table engagement cell: a small progress ring filled to the
 * watch percent in the engagement color, with the percent beside it. "not
 * started" (with a play glyph, so it reads as the video at a glance) when
 * there is no progress row at all — an honest empty, not a 0%.
 */
export function VideoWatchedRing({
  percent,
  completed,
}: {
  percent: number | null;
  completed: boolean;
}) {
  if (percent === null || percent <= 0) {
    return (
      <span className="flex items-center gap-1.5 text-[13.5px] leading-[1.45] text-ghost-foreground">
        <Play aria-hidden className="size-3.5 shrink-0 fill-current" strokeWidth={0} />
        not started
      </span>
    );
  }
  const clamped = Math.min(100, Math.max(0, Math.round(percent)));
  const color = watchColor(clamped, completed);

  return (
    <span className="flex items-center gap-2">
      <svg viewBox="0 0 28 28" aria-hidden className="size-[26px] shrink-0 -rotate-90">
        <circle cx="14" cy="14" r={RADIUS} fill="none" stroke="#f2f3f6" strokeWidth="4.5" />
        <circle
          cx="14"
          cy="14"
          r={RADIUS}
          fill="none"
          stroke={color}
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - clamped / 100)}
        />
      </svg>
      <span className="tabular text-[13px] font-bold" style={{ color }}>
        {clamped}%
      </span>
    </span>
  );
}
