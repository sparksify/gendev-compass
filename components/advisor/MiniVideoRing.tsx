/** Compact donut for the Video column of the client list table — same
 * technique as the client detail page's larger DonutStat, scaled down. */
export function MiniVideoRing({ percent, completed }: { percent: number; completed: boolean }) {
  const radius = 15;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(100, Math.max(0, percent));
  const offset = circumference * (1 - clamped / 100);
  const color = completed || clamped >= 100 ? "var(--success)" : "var(--primary)";

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="relative flex size-7 shrink-0 items-center justify-center">
        <svg viewBox="0 0 36 36" className="size-full -rotate-90">
          <circle cx="18" cy="18" r={radius} fill="none" stroke="var(--border-soft)" strokeWidth="3" />
          <circle
            cx="18"
            cy="18"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
      </span>
      <span className="text-xs font-medium tabular-nums text-secondary-foreground">{Math.round(clamped)}%</span>
    </span>
  );
}
