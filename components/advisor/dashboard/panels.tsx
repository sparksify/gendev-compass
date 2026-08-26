import { cn } from "@/lib/utils";

/**
 * One metric: a 2px rule in the metric's color, an overline label, a 38px
 * display numeral in the same color, and a footnote. No card, no shadow —
 * the rule is the whole container. (The advisor overview moved to icon stat
 * cards — components/advisor/dashboard/overview.tsx — this remains the
 * platform admin's metric style.)
 */
export function MetricRule({
  label,
  value,
  footnote,
  color,
  labelColor,
}: {
  label: string;
  value: string;
  footnote: React.ReactNode;
  color: string;
  /** Alert metrics color their label too. */
  labelColor?: string;
}) {
  return (
    <div className="border-t-2 pt-3.5" style={{ borderTopColor: color }}>
      <p
        className="text-[11px] font-bold uppercase tracking-[0.15em]"
        style={{ color: labelColor ?? "#98a2b3" }}
      >
        {label}
      </p>
      {/* An empty metric steps down rather than drawing a 38px rule. */}
      <p
        className={cn(
          "tabular mt-2.5 font-extrabold leading-none tracking-[-0.04em]",
          value === "—" ? "text-[26px] leading-[1.2] text-ghost-foreground" : "text-[38px]",
        )}
        style={value === "—" ? undefined : { color }}
      >
        {value}
      </p>
      <p className="mt-2.5 text-[13px] text-muted-foreground">{footnote}</p>
    </div>
  );
}

/** "2h" / "19h" / "3d" — the compact form activity lists use. */
export function relativeShort(iso: string, now: Date = new Date()): string {
  const ms = now.getTime() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "now";
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 1) return `${Math.max(1, Math.floor(ms / 60_000))}m`;
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}
