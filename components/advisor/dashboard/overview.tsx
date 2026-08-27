import Link from "next/link";
import {
  ArrowUpRight,
  ChartColumn,
  ChevronDown,
  CircleCheck,
  Map as MapIcon,
  MoreVertical,
  Phone,
  Send,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Panel, Pill } from "@/components/advisor/v3";
import { SECONDARY_BUTTON_SM } from "@/components/advisor/controls";
import { relativeShort } from "@/components/advisor/dashboard/panels";
import type { DiscoveryStageId } from "@/lib/advisor/discoveryStages";
import type {
  ActivityItem,
  ConversionStep,
  PipelineSegment,
  WorkQueueItem,
} from "@/lib/advisor/briefing";

/**
 * One icon per discovery stage. The colors are NOT restated here — the v3
 * handoff puts the dashboard on the same five hues as the clients list and
 * the detail page, so each card reads its stage's own color and tint from
 * lib/advisor/discoveryStages.
 */
const STAGE_ICON: Record<
  DiscoveryStageId,
  React.ComponentType<{ className?: string; strokeWidth?: number }>
> = {
  1: Phone,
  2: ChartColumn,
  3: MapIcon,
  4: Send,
  5: CircleCheck,
};

/** The v3 stat card: a rounded icon chip, the label, the count, a delta. */
export function StatCard({
  icon: Icon,
  color,
  tint,
  label,
  value,
  delta,
  /** Deltas of zero read as neutral rather than as growth. */
  positive = true,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  color: string;
  tint: string;
  label: string;
  value: number;
  delta: string;
  positive?: boolean;
}) {
  return (
    <Panel className="px-[18px] py-[15px]">
      <div className="flex items-center gap-[11px]">
        <span
          className="flex size-[34px] shrink-0 items-center justify-center rounded-[10px]"
          style={{ backgroundColor: tint, color }}
        >
          <Icon className="size-[15px]" strokeWidth={2} />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[12px] font-semibold text-muted-foreground">
            {label}
          </span>
          <span className="tabular mt-px block text-[21px] font-extrabold leading-tight text-foreground">
            {value}
          </span>
        </span>
      </div>
      <p
        className={cn(
          "mt-2.5 flex items-center gap-1 text-[12px]",
          positive ? "font-bold text-success" : "font-semibold text-faint-foreground",
        )}
      >
        {delta}
        {positive && <ArrowUpRight className="size-3" strokeWidth={2.2} />}
      </p>
    </Panel>
  );
}

/** One pipeline stage card: icon, name, count, share, colored bottom bar. */
export function StageCard({ segment, total }: { segment: PipelineSegment; total: number }) {
  const { stage, count } = segment;
  const Icon = STAGE_ICON[stage.id];
  const share = total > 0 ? Math.round((count / total) * 100) : 0;

  return (
    <Link
      href={`/advisor/investors?stage=${stage.id}`}
      className="block overflow-hidden rounded-card border border-border bg-card px-[18px] pt-[15px] transition-colors hover:bg-surface-raised"
    >
      <span className="flex items-center gap-[11px]">
        <span
          className="flex size-[34px] shrink-0 items-center justify-center rounded-[10px]"
          style={{ backgroundColor: stage.tint, color: stage.color }}
        >
          <Icon className="size-[15px]" strokeWidth={2} />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[12px] font-semibold text-muted-foreground">
            {stage.tiny}
          </span>
          <span className="tabular mt-px block text-[20px] font-extrabold leading-tight text-foreground">
            {count}
          </span>
        </span>
      </span>
      <span className="mb-3 mt-2 block text-[11.5px] font-semibold text-faint-foreground">
        {share}% of pipeline
      </span>
      <span
        aria-hidden
        className="-mx-[18px] block h-1"
        style={{ backgroundColor: stage.color }}
      />
    </Link>
  );
}

/** A panel title with a yellow count chip beside it ("Work Queue 6"). */
export function CountTitle({ label, count }: { label: string; count?: number }) {
  return (
    <p className="inline-flex items-center gap-2 text-[15px] font-bold text-foreground">
      {label}
      {count !== undefined && (
        <span className="tabular inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-pill bg-[#fff6d9] px-[5px] text-[11px] font-extrabold text-accent-strong">
          {count}
        </span>
      )}
    </p>
  );
}

/** The faint "Last 24 hours ⌄" range label panels carry on the right. */
export function RangeLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1 text-[12px] font-semibold text-muted-foreground">
      {children}
      <ChevronDown className="size-3" strokeWidth={2} />
    </span>
  );
}

/** A work-queue row: the task, an overdue pill, the one-word CTA, a kebab. */
export function QueueRow({ item, last }: { item: WorkQueueItem; last: boolean }) {
  const overdue = item.marker?.kind === "overdue";

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
    <div
      className={cn(
        "flex items-center gap-3.5 py-[11px]",
        !last && "border-b border-border-soft",
      )}
    >
      <Link href={`/advisor/investors/${item.leadId}`} className="group min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-bold text-foreground group-hover:underline">
          {item.title}
        </span>
        <span className="mt-0.5 block truncate text-[12px] font-medium text-muted-foreground">
          {item.detail}
        </span>
      </Link>

      {overdue && item.marker?.kind === "overdue" && (
        <Pill tone="danger" className="hidden sm:inline-flex">
          {item.marker.label}
        </Pill>
      )}
      {item.marker?.kind === "warm" && (
        <Pill tone="success" dot className="hidden sm:inline-flex">
          Warm
        </Pill>
      )}

      <span className="shrink-0">{cta}</span>
      <Link
        href={`/advisor/investors/${item.leadId}`}
        aria-label="Open client"
        className="shrink-0 rounded-md p-1 text-ghost-foreground transition-colors hover:bg-surface-raised hover:text-foreground"
      >
        <MoreVertical className="size-4" strokeWidth={2} />
      </Link>
    </div>
  );
}

/** Activity monitor row: dot, bold name + what they did, short time. */
export function MonitorRow({ item, last }: { item: ActivityItem; last: boolean }) {
  return (
    <Link
      href={`/advisor/investors/${item.leadId}`}
      className={cn(
        "flex items-center justify-between gap-2.5 py-2 text-[13px] text-secondary-foreground hover:bg-surface-raised",
        !last && "border-b border-border-soft",
      )}
    >
      <span className="min-w-0 flex-1 truncate">
        <span
          aria-hidden
          className="mr-2.5 inline-block size-1.5 rounded-full align-[2px]"
          style={{ backgroundColor: item.color }}
        />
        <strong className="font-bold text-foreground">{item.name}</strong> {item.text}
      </span>
      <span className="tabular shrink-0 text-[12px] font-semibold text-faint-foreground">
        {relativeShort(item.at)}
      </span>
    </Link>
  );
}

/** Stage-conversion row: from-stage dot, "A → B", dotted leader, percent. */
export function ConversionRow({ step }: { step: ConversionStep }) {
  return (
    <span className="flex items-center justify-between gap-3.5 border-b border-dotted border-border-leader py-[9px] text-[13px] last:border-b-0">
      <span className="min-w-0 truncate text-secondary-foreground">
        <span
          aria-hidden
          className="mr-2.5 inline-block size-1.5 rounded-full align-[2px]"
          style={{ backgroundColor: step.from.color }}
        />
        {step.from.tiny} → {step.to.tiny}
      </span>
      <strong
        className={cn(
          "tabular shrink-0 font-extrabold",
          step.percent === null ? "text-ghost-foreground" : "text-foreground",
        )}
      >
        {step.percent === null ? "—" : `${step.percent}%`}
      </strong>
    </span>
  );
}
