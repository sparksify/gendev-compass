import { SIGNAL, DISCOVERY_STAGES } from "@/lib/advisor/discoveryStages";

/** Watch-percent color coding: finished is green, healthy progress teal,
 * a stalled early exit amber (handoff: "Video-watch color coding"). */
export function watchColor(percent: number, completed: boolean): string {
  if (completed || percent >= 100) return SIGNAL.success;
  if (percent >= 50) return DISCOVERY_STAGES[0].color;
  return SIGNAL.warning;
}

/**
 * The clients-table engagement cell: a 70×5px track with a colored fill and
 * the percent in the same color. "not started" when there is no progress row
 * at all — an honest empty, not a 0%.
 */
export function VideoWatchedBar({
  percent,
  completed,
}: {
  percent: number | null;
  completed: boolean;
}) {
  if (percent === null || percent <= 0) {
    return <span className="text-[13.5px] leading-[1.45] text-ghost-foreground">not started</span>;
  }
  const clamped = Math.min(100, Math.max(0, Math.round(percent)));
  const color = watchColor(clamped, completed);

  return (
    <span className="flex items-center gap-2">
      <span className="h-[5px] w-[70px] shrink-0 overflow-hidden rounded-full bg-border-soft">
        <span
          className="block h-[5px] rounded-full"
          style={{ width: `${clamped}%`, backgroundColor: color }}
        />
      </span>
      <span className="tabular text-[13px] font-bold" style={{ color }}>
        {clamped}%
      </span>
    </span>
  );
}
