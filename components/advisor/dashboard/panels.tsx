import Link from "next/link";
import { cn } from "@/lib/utils";
import { INK_BUTTON_SM, SECONDARY_BUTTON_SM } from "@/components/advisor/controls";
import { SIGNAL } from "@/lib/advisor/discoveryStages";
import type {
  ActivityItem,
  ConversionStep,
  PipelineSegment,
  WorkQueueItem,
} from "@/lib/advisor/briefing";

/**
 * One metric: a 2px rule in the metric's color, an overline label, a 38px
 * display numeral in the same color, and a footnote. No card, no shadow —
 * the rule is the whole container.
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
        className="text-[9.5px] font-bold uppercase tracking-[0.15em]"
        style={{ color: labelColor ?? "#98a2b3" }}
      >
        {label}
      </p>
      {/* An empty metric steps down rather than drawing a 38px rule. */}
      <p
        className={cn(
          "tabular mt-2.5 font-extrabold leading-none tracking-[-0.04em]",
          value === "—" ? "text-2xl text-ghost-foreground" : "text-[38px]",
        )}
        style={value === "—" ? undefined : { color }}
      >
        {value}
      </p>
      <p className="mt-2.5 text-[11.5px] text-muted-foreground">{footnote}</p>
    </div>
  );
}

/**
 * The discovery funnel: one segment per stage, sized to its share of the
 * pipeline, with the count centered in white and the stage label beneath in
 * the matching color and the matching flex ratio.
 */
export function PipelineBar({ segments }: { segments: PipelineSegment[] }) {
  const total = segments.reduce((sum, segment) => sum + segment.count, 0);
  const anyCount = total > 0;

  return (
    <div>
      <div className="flex h-10 gap-[3px] overflow-hidden rounded-md">
        {segments.map(({ stage, count }) => (
          <Link
            key={stage.id}
            href={`/advisor/investors?stage=${stage.id}`}
            style={{ flex: anyCount ? count : 1, backgroundColor: stage.color }}
            className={cn(
              "tabular flex min-w-[26px] items-center justify-center text-xs font-extrabold text-white transition-opacity hover:opacity-90",
              count === 0 && "opacity-25",
            )}
          >
            {count}
          </Link>
        ))}
      </div>
      <div className="mt-2 flex gap-[3px]">
        {segments.map(({ stage, count }) => (
          <span
            key={stage.id}
            style={{ flex: anyCount ? count : 1, color: stage.color }}
            className="min-w-[52px] truncate text-[10px] font-bold"
          >
            STAGE {stage.id}
            {/* The stage name only fits once the segment owns enough width. */}
            {anyCount && count / total >= 0.15 ? ` · ${stage.tiny}` : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

/** A work-queue row: stage spine, action title, reason, marker, one CTA. */
export function WorkQueueRow({ item, primary }: { item: WorkQueueItem; primary: boolean }) {
  const cta = item.mailto ? (
    <a href={item.mailto} className={primary ? INK_BUTTON_SM : SECONDARY_BUTTON_SM}>
      {item.ctaLabel}
    </a>
  ) : (
    <Link
      href={`/advisor/investors/${item.leadId}`}
      className={primary ? INK_BUTTON_SM : SECONDARY_BUTTON_SM}
    >
      Open
    </Link>
  );

  return (
    <div className="flex items-center gap-3.5 border-b border-border-soft py-3.5 last:border-b-0">
      <span
        aria-hidden
        className="h-[34px] w-[3px] shrink-0 rounded-full"
        style={{ backgroundColor: item.spineColor }}
      />
      <Link href={`/advisor/investors/${item.leadId}`} className="min-w-0 flex-1 group">
        <span className="block truncate text-sm font-bold tracking-[-0.015em] text-foreground group-hover:underline">
          {item.title}
        </span>
        <span className="mt-[3px] block truncate text-xs text-muted-foreground">{item.detail}</span>
      </Link>
      {item.marker?.kind === "overdue" && (
        <span className="shrink-0 text-[9.5px] font-bold tracking-[0.08em] text-destructive">
          {item.marker.label}
        </span>
      )}
      {item.marker?.kind === "warm" && (
        <span
          className="inline-flex shrink-0 items-center gap-1.5 text-[9.5px] font-bold tracking-[0.08em]"
          style={{ color: SIGNAL.success }}
        >
          <span
            aria-hidden
            className="size-[5px] rounded-full"
            style={{ backgroundColor: SIGNAL.success }}
          />
          WARM
        </span>
      )}
      <span className="shrink-0">{cta}</span>
    </div>
  );
}

/** A dotted-leader schedule row: time, name, leader, stage-colored type. */
export function ScheduleRow({
  time,
  name,
  typeLabel,
  typeColor,
  href,
}: {
  time: string;
  name: string;
  typeLabel: string;
  typeColor: string;
  href: string | null;
}) {
  const label = (
    <span className="shrink-0 text-[13px] font-semibold text-foreground">{name}</span>
  );
  return (
    <div className="flex items-baseline gap-3 border-b border-dotted border-border-leader py-2.5 last:border-b-0">
      <span className="tabular w-[46px] shrink-0 text-xs font-bold text-foreground">{time}</span>
      {href ? (
        <Link href={href} className="shrink-0 hover:underline">
          {label}
        </Link>
      ) : (
        label
      )}
      <span aria-hidden className="-translate-y-[3px] flex-1 border-b border-dotted border-border-leader" />
      <span className="shrink-0 text-[11px] font-bold" style={{ color: typeColor }}>
        {typeLabel}
      </span>
    </div>
  );
}

export function ConversionList({ steps }: { steps: ConversionStep[] }) {
  return (
    <div className="flex flex-col gap-2 text-xs">
      {steps.map((step) => (
        <div key={step.from.id} className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="size-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: step.from.color }}
          />
          <span className="flex-1 truncate text-muted-foreground">
            {step.from.tiny} → {step.to.tiny}
          </span>
          <strong className="tabular font-bold text-foreground">
            {step.percent === null ? "—" : `${step.percent}%`}
          </strong>
        </div>
      ))}
    </div>
  );
}

export function ActivityList({
  items,
  emptyMessage,
}: {
  items: ActivityItem[];
  emptyMessage: string;
}) {
  if (items.length === 0) {
    return <p className="py-2 text-[12.5px] text-muted-foreground">{emptyMessage}</p>;
  }
  return (
    <div className="flex flex-col text-[12.5px] text-secondary-foreground">
      {items.map((item, index) => (
        <Link
          key={`${item.leadId}-${index}`}
          href={`/advisor/investors/${item.leadId}`}
          className="flex justify-between gap-2.5 border-b border-[#f6f6f7] py-2 last:border-b-0 hover:bg-surface-raised"
        >
          <span className="min-w-0">
            <span
              aria-hidden
              className="mr-2 inline-block size-1.5 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <strong className="font-bold">{item.name}</strong> {item.text}
          </span>
          <span className="tabular shrink-0 text-ghost-foreground">{relativeShort(item.at)}</span>
        </Link>
      ))}
    </div>
  );
}

/** "2h" / "19h" / "3d" — the compact form the right rail uses. */
export function relativeShort(iso: string, now: Date = new Date()): string {
  const ms = now.getTime() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "now";
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 1) return `${Math.max(1, Math.floor(ms / 60_000))}m`;
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}
