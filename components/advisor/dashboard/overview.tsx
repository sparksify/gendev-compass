import Link from "next/link";
import {
  ChartColumn,
  CheckCircle2,
  ChevronDown,
  Map as MapIcon,
  Phone,
  Send,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { InitialsBadge, Panel, Pill } from "@/components/advisor/v3";
import { ACCENT_BUTTON_SM } from "@/components/advisor/controls";
import { relativeShort } from "@/components/advisor/dashboard/panels";
import type { DiscoveryStageId } from "@/lib/advisor/discoveryStages";
import type {
  ActivityItem,
  ConversionStep,
  PipelineSegment,
  WorkQueueItem,
} from "@/lib/advisor/briefing";

/**
 * The Pipeline card's ramp: an icon and a rule color per discovery stage.
 *
 * The rule colors are the handoff's own — a warm ramp from the brand green
 * through to closing green — and are deliberately NOT the stage-chip spectrum
 * the clients list and detail page use. Here the color reads as position
 * along the pipeline, not as a stage identity, and the two live on different
 * screens. Everything semantic on this page (activity dots, conversion bars)
 * still reads the real spectrum from lib/advisor/discoveryStages.
 */
const PIPELINE_RAMP: Record<
  DiscoveryStageId,
  { color: string; icon: React.ComponentType<React.SVGProps<SVGSVGElement>> }
> = {
  1: { color: "#1b7a61", icon: Phone },
  2: { color: "#2463eb", icon: ChartColumn },
  3: { color: "#6d28d9", icon: MapIcon },
  4: { color: "#c2410c", icon: Send },
  5: { color: "#178042", icon: CheckCircle2 },
};

/**
 * A stat card: the icon chip and the week's delta on one line, then the
 * number, its label and the period it covers. A zero delta reads neutral —
 * "+0 this week" is not growth, and coloring it green would say it was.
 */
export function StatCard({
  icon: Icon,
  color,
  tint,
  label,
  period,
  value,
  delta,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  color: string;
  tint: string;
  label: string;
  /** "new this week" / "this week" — the line under the label. */
  period: string;
  value: number;
  delta: number;
}) {
  const rising = delta > 0;
  const empty = value === 0;

  return (
    <Panel className="px-[18px] pb-[13px] pt-[15px]">
      <div className="flex items-center justify-between gap-2.5">
        <span
          className="flex size-[34px] shrink-0 items-center justify-center rounded-[10px]"
          style={{ backgroundColor: tint, color }}
        >
          <Icon className="size-[15px]" strokeWidth={2} />
        </span>
        <span
          className={cn(
            "tabular inline-flex items-center rounded-pill px-[9px] py-0.5 text-[11px] font-extrabold",
            rising ? "bg-success-soft text-success" : "bg-[#eef1ef] text-faint-foreground",
          )}
        >
          {rising ? "↗ " : ""}+{delta}
        </span>
      </div>
      <p
        className={cn(
          "tabular mt-[11px] text-[26px] font-extrabold leading-none",
          empty ? "text-faint-foreground" : "text-foreground",
        )}
      >
        {value}
      </p>
      <p className="mt-[5px] text-[12px] font-bold text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-[11.5px] font-medium text-faint-foreground">{period}</p>
    </Panel>
  );
}

/**
 * The whole pipeline as one card: a stacked bar of where everyone is, then a
 * ruled column per stage. Replaces the five separate cards — the shape of the
 * pipeline is the point, and five cards made it a row of unrelated numbers.
 */
export function PipelineCard({
  segments,
  total,
}: {
  segments: PipelineSegment[];
  total: number;
}) {
  return (
    <Panel>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[15px] font-bold text-foreground">Pipeline</p>
        <p className="tabular text-[12px] font-semibold text-muted-foreground">
          {total} client{total === 1 ? "" : "s"} across {segments.length} stages
        </p>
      </div>

      <div className="mt-[13px] flex h-3.5 gap-0.5 overflow-hidden rounded-lg bg-border-soft">
        {segments.map((segment) => {
          const share = total > 0 ? (segment.count / total) * 100 : 0;
          if (share === 0) return null;
          return (
            <span
              key={segment.stage.id}
              title={`${segment.stage.tiny}: ${segment.count}`}
              style={{
                flex: `0 0 ${share}%`,
                backgroundColor: PIPELINE_RAMP[segment.stage.id].color,
              }}
            />
          );
        })}
      </div>

      <div className="mt-[13px] grid gap-3.5 sm:grid-cols-3 xl:grid-cols-5">
        {segments.map((segment) => {
          const ramp = PIPELINE_RAMP[segment.stage.id];
          const Icon = ramp.icon;
          const share = total > 0 ? Math.round((segment.count / total) * 100) : 0;
          const empty = segment.count === 0;

          return (
            <Link
              key={segment.stage.id}
              href={`/advisor/investors?stage=${segment.stage.id}`}
              className="border-t-2 pt-2 transition-opacity hover:opacity-70"
              style={{ borderTopColor: ramp.color }}
            >
              <span className="flex items-center gap-[7px] text-[11px] font-bold text-muted-foreground">
                <Icon className="size-3 shrink-0" strokeWidth={2} style={{ color: ramp.color }} />
                {segment.stage.tiny}
              </span>
              <span
                className={cn(
                  "tabular mt-[5px] block text-[20px] font-extrabold",
                  empty ? "text-faint-foreground" : "text-foreground",
                )}
              >
                {segment.count}{" "}
                <span
                  className={cn(
                    "text-[11.5px] font-semibold",
                    empty ? "text-ghost-foreground" : "text-faint-foreground",
                  )}
                >
                  {share}%
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </Panel>
  );
}

/** A work-queue row: who, why, how overdue, and the one-word nudge. */
export function QueueRow({ item, last }: { item: WorkQueueItem; last: boolean }) {
  const cta = item.mailto ? (
    <a href={item.mailto} className={ACCENT_BUTTON_SM}>
      {item.ctaLabel}
    </a>
  ) : (
    <Link href={`/advisor/investors/${item.leadId}`} className={ACCENT_BUTTON_SM}>
      Open
    </Link>
  );

  return (
    <div
      className={cn("flex items-center gap-3 py-2.5", !last && "border-b border-border-soft")}
    >
      <InitialsBadge name={item.name} />

      <span className="min-w-0 flex-1">
        <Link
          href={`/advisor/investors/${item.leadId}`}
          className="block truncate text-[13.5px] font-bold text-foreground hover:underline"
        >
          {item.name}
        </Link>
        <span className="block truncate text-[11.5px] font-medium text-faint-foreground">
          {item.detail}
        </span>
      </span>

      {item.marker?.kind === "overdue" && (
        <Pill tone="danger" className="hidden text-[11px] font-extrabold sm:inline-flex">
          {item.marker.label}
        </Pill>
      )}
      {item.marker?.kind === "warm" && (
        <Pill tone="success" dot className="hidden sm:inline-flex">
          Warm
        </Pill>
      )}

      <span className="shrink-0">{cta}</span>
    </div>
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

/** Activity monitor row: dot, linked name + what they did, short time. */
export function MonitorRow({ item, last }: { item: ActivityItem; last: boolean }) {
  return (
    <span
      className={cn(
        "flex items-center justify-between gap-2.5 py-[9px] text-[13px]",
        !last && "border-b border-border-soft",
      )}
    >
      <span className="min-w-0 truncate">
        <span
          aria-hidden
          className="mr-2.5 inline-block size-1.5 rounded-full align-[2px]"
          style={{ backgroundColor: item.color }}
        />
        <Link
          href={`/advisor/investors/${item.leadId}`}
          className="font-bold text-foreground hover:underline"
        >
          {item.name}
        </Link>{" "}
        <span className="text-muted-foreground">{item.text}</span>
      </span>
      <span className="tabular shrink-0 font-semibold text-faint-foreground">
        {relativeShort(item.at)}
      </span>
    </span>
  );
}

/**
 * Stage-conversion row: the step, its rate, and a bar. The bar is what makes
 * a 9% legible next to a 0% — as bare numbers they read as equally small.
 */
export function ConversionRow({ step }: { step: ConversionStep }) {
  const known = step.percent !== null;
  return (
    <div>
      <div className="flex justify-between gap-3 text-[12.5px] font-semibold text-muted-foreground">
        <span className="min-w-0 truncate">
          {step.from.tiny} → {step.to.tiny}
        </span>
        <span
          className={cn(
            "tabular shrink-0 font-extrabold",
            known ? "text-foreground" : "text-ghost-foreground",
          )}
        >
          {known ? `${step.percent}%` : "—"}
        </span>
      </div>
      <div className="mt-1 h-[5px] overflow-hidden rounded-[5px] bg-border-soft">
        {known && step.percent! > 0 && (
          <span
            className="block h-full rounded-[5px]"
            style={{ width: `${step.percent}%`, backgroundColor: PIPELINE_RAMP[step.from.id].color }}
          />
        )}
      </div>
    </div>
  );
}
