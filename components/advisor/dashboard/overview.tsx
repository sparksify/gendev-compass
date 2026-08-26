import Link from "next/link";
import {
  ArrowUpRight,
  CalendarDays,
  ChartColumn,
  ChevronDown,
  CircleCheck,
  Map as MapIcon,
  MoreVertical,
  Phone,
  Send,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SECONDARY_BUTTON_SM } from "@/components/advisor/controls";
import { relativeShort } from "@/components/advisor/dashboard/panels";
import { DISCOVERY_STAGES, type DiscoveryStageId } from "@/lib/advisor/discoveryStages";
import type { ActivityItem, ConversionStep, PipelineSegment, WorkQueueItem } from "@/lib/advisor/briefing";

/**
 * The overview mock's own stage palette. It reuses the app's five hues but
 * swaps violet onto Intro Call and teal onto FDD & Territory (the reverse of
 * the chip spectrum the rest of the app wears) — scoped here so the clients
 * list and detail pages keep their existing colors.
 */
const DASH_STAGE: Record<
  DiscoveryStageId,
  { color: string; tint: string; icon: React.ComponentType<{ className?: string; strokeWidth?: number }> }
> = {
  1: { color: "#6d28d9", tint: "#f3eefb", icon: Phone },
  2: { color: "#2463eb", tint: "#edf2fe", icon: ChartColumn },
  3: { color: "#0e7490", tint: "#e9f5f8", icon: MapIcon },
  4: { color: "#d97706", tint: "#fdf3e6", icon: Send },
  5: { color: "#15803d", tint: "#ecf9f1", icon: CircleCheck },
};

/** Overdue reds — brighter than the app's alert ink, per the mock. */
const OVERDUE = "#dc2626";
const DELTA_GREEN = "#16a34a";

/** Stage-spectrum color → this page's palette, for activity dots etc. */
const REMAP: Record<string, string> = Object.fromEntries(
  DISCOVERY_STAGES.map((stage) => [stage.color, DASH_STAGE[stage.id].color]),
);
export function dashColor(color: string): string {
  return REMAP[color] ?? color;
}

/** The white rounded card every panel on this page sits in. */
export function Card({
  id,
  className,
  children,
}: {
  id?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div id={id} className={cn("rounded-2xl border border-border bg-card", className)}>
      {children}
    </div>
  );
}

/** Icon-circle stat card: Active Leads 213, "+ 89 new this week ↗". */
export function StatCard({
  icon: Icon,
  color,
  tint,
  label,
  value,
  delta,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  color: string;
  tint: string;
  label: string;
  value: number;
  delta: string;
}) {
  return (
    <Card className="px-5 py-[18px]">
      <div className="flex items-center gap-3.5">
        <span
          className="flex size-11 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: tint, color }}
        >
          <Icon className="size-5" strokeWidth={1.8} />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[13.5px] font-medium text-muted-foreground">
            {label}
          </span>
          <span className="tabular mt-0.5 block text-[27px] font-extrabold leading-none tracking-[-0.02em] text-foreground">
            {value}
          </span>
        </span>
      </div>
      <p
        className="mt-3 flex items-center gap-1 text-[13px] font-semibold"
        style={{ color: DELTA_GREEN }}
      >
        {delta}
        <ArrowUpRight className="size-3.5" strokeWidth={2.2} />
      </p>
    </Card>
  );
}

/** One pipeline stage card: icon, name, count, share, colored bottom bar. */
export function StageCard({ segment, total }: { segment: PipelineSegment; total: number }) {
  const { stage, count } = segment;
  const dash = DASH_STAGE[stage.id];
  const Icon = dash.icon;
  const share = total > 0 ? Math.round((count / total) * 100) : 0;

  return (
    <Link
      href={`/advisor/investors?stage=${stage.id}`}
      className="relative block overflow-hidden rounded-2xl border border-border bg-card px-5 pb-[22px] pt-5 transition-colors hover:bg-surface-raised"
    >
      <span className="flex items-center justify-center gap-3.5">
        <span
          className="flex size-11 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: dash.tint, color: dash.color }}
        >
          <Icon className="size-5" strokeWidth={1.8} />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[13.5px] font-medium text-muted-foreground">
            {stage.tiny}
          </span>
          <span className="tabular mt-0.5 block text-[27px] font-extrabold leading-none tracking-[-0.02em] text-foreground">
            {count}
          </span>
        </span>
      </span>
      <span className="mt-2.5 block text-center text-[12.5px] text-faint-foreground">
        {share}% of pipeline
      </span>
      <span
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-[5px]"
        style={{ backgroundColor: dash.color }}
      />
    </Link>
  );
}

/** Panel header: "WORK QUEUE" + count chip on the left, an action right. */
export function PanelHeader({
  label,
  chip,
  right,
}: {
  label: string;
  chip?: number;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.13em] text-foreground">
        {label}
        {chip !== undefined && (
          <span className="tabular inline-flex min-w-[22px] items-center justify-center rounded-md bg-surface-raised px-1.5 py-0.5 text-[11.5px] font-bold normal-case tracking-normal text-secondary-foreground">
            {chip}
          </span>
        )}
      </p>
      {right}
    </div>
  );
}

/** The faint "Last 24 hours ⌄" range label panels carry on the right. */
export function RangeLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1 text-[13px] text-faint-foreground">
      {children}
      <ChevronDown className="size-3.5" strokeWidth={2} />
    </span>
  );
}

/** A work-queue row: red spine, task, overdue marker, Remind, kebab. */
export function QueueRow({ item }: { item: WorkQueueItem }) {
  const overdue = item.marker?.kind === "overdue";
  const spine = overdue ? OVERDUE : dashColor(item.spineColor);

  const cta = item.mailto ? (
    <a href={item.mailto} className={SECONDARY_BUTTON_SM}>
      {item.ctaLabel}
    </a>
  ) : (
    <Link href={`/advisor/investors/${item.leadId}`} className={SECONDARY_BUTTON_SM}>
      Open
    </Link>
  );

  return (
    <div className="flex items-center gap-3.5 border-b border-border-soft py-3.5 last:border-b-0 last:pb-1">
      <span
        aria-hidden
        className="h-[38px] w-[3px] shrink-0 rounded-full"
        style={{ backgroundColor: spine }}
      />
      <Link href={`/advisor/investors/${item.leadId}`} className="group min-w-0 flex-1">
        <span className="block truncate text-[15px] font-bold tracking-[-0.01em] text-foreground group-hover:underline">
          {item.title}
        </span>
        <span className="mt-[3px] block truncate text-[13px] text-muted-foreground">
          {item.detail}
        </span>
      </Link>
      {overdue && item.marker?.kind === "overdue" && (
        <span
          className="hidden shrink-0 items-center gap-1.5 text-[11.5px] font-bold tracking-[0.06em] sm:inline-flex"
          style={{ color: OVERDUE }}
        >
          <CalendarDays className="size-[13px]" strokeWidth={2} />
          {item.marker.label}
        </span>
      )}
      {item.marker?.kind === "warm" && (
        <span
          className="hidden shrink-0 items-center gap-1.5 text-[11.5px] font-bold tracking-[0.06em] sm:inline-flex"
          style={{ color: DELTA_GREEN }}
        >
          <span aria-hidden className="size-[5px] rounded-full" style={{ backgroundColor: DELTA_GREEN }} />
          WARM
        </span>
      )}
      <span className="shrink-0">{cta}</span>
      <Link
        href={`/advisor/investors/${item.leadId}`}
        aria-label="Open client"
        className="shrink-0 rounded-md p-1 text-faint-foreground transition-colors hover:bg-surface-raised hover:text-foreground"
      >
        <MoreVertical className="size-4" strokeWidth={2} />
      </Link>
    </div>
  );
}

/** Activity monitor row: dot, bold name + what they did, short time. */
export function MonitorRow({ item }: { item: ActivityItem }) {
  return (
    <Link
      href={`/advisor/investors/${item.leadId}`}
      className="flex items-center gap-2.5 py-[7px] text-[13.5px] text-secondary-foreground hover:bg-surface-raised"
    >
      <span
        aria-hidden
        className="size-[7px] shrink-0 rounded-full"
        style={{ backgroundColor: dashColor(item.color) }}
      />
      <span className="min-w-0 flex-1 truncate">
        <strong className="font-bold text-foreground">{item.name}</strong> {item.text}
      </span>
      <span className="tabular shrink-0 text-[12.5px] text-faint-foreground">
        {relativeShort(item.at)}
      </span>
    </Link>
  );
}

/** Stage-conversion row: from-stage dot, "A → B", leader, percent. */
export function ConversionRow({ step }: { step: ConversionStep }) {
  return (
    <div className="flex items-center gap-2.5 py-[7px] text-[13.5px]">
      <span
        aria-hidden
        className="size-[7px] shrink-0 rounded-full"
        style={{ backgroundColor: DASH_STAGE[step.from.id].color }}
      />
      <span className="shrink-0 text-muted-foreground">
        {step.from.tiny} → {step.to.tiny}
      </span>
      <span aria-hidden className="h-px min-w-4 flex-1 bg-border-soft" />
      <strong className="tabular shrink-0 font-bold text-foreground">
        {step.percent === null ? "—" : `${step.percent}%`}
      </strong>
    </div>
  );
}
