import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * The advisor "v3" primitives (Claude Design handoff, CRM Dashboard project).
 *
 * Every advisor screen is built from the same five shapes: a centered page
 * column on the green canvas, a white bordered panel, a tinted status pill, an
 * uppercase table header, and the yellow-underlined tab row. Keeping them here
 * means a spacing or tint change lands once instead of on seven pages.
 *
 * Colors come from the .advisor-theme tokens (app/globals.css) — nothing in
 * this file hardcodes a hex except the stage hues, which are owned by
 * lib/advisor/discoveryStages.
 */

/* -------------------------------------------------------------------------
 * Page scaffolding
 * ---------------------------------------------------------------------- */

/**
 * The page column: 1400px of content centered on the canvas, with the
 * handoff's 14px rhythm between blocks. `width="narrow"` is the 980px column
 * the Team screen uses.
 */
export function V3Page({
  width = "wide",
  className,
  children,
}: {
  width?: "wide" | "narrow";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <main
      className={cn(
        "mx-auto flex w-full flex-col gap-3.5 px-5 pb-9 pt-6 lg:px-7",
        width === "wide" ? "max-w-[1400px]" : "max-w-[980px]",
        className,
      )}
    >
      {children}
    </main>
  );
}

/**
 * The page's opening row: a 24/800 title, an optional inline count or
 * sentence beside it, and right-aligned actions.
 */
export function PageTitle({
  title,
  meta,
  actions,
  stacked = false,
}: {
  title: string;
  /** Sits beside the title (a count, a one-line description). */
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  /** Put the meta under the title instead of beside it (the dashboard greeting). */
  stacked?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
      <div
        className={cn(
          "flex min-w-0 flex-wrap gap-x-3",
          stacked ? "flex-col gap-y-1" : "items-baseline gap-y-1",
        )}
      >
        <h1 className="text-[24px] font-extrabold tracking-[-0.02em] text-foreground">{title}</h1>
        {meta && (
          <p className="text-[13px] font-semibold text-muted-foreground">{meta}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2.5">{actions}</div>}
    </div>
  );
}

/* -------------------------------------------------------------------------
 * Panels
 * ---------------------------------------------------------------------- */

/** The white bordered card every block on every screen sits in. */
export function Panel({
  className,
  padded = true,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { padded?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-card border border-border bg-card",
        padded && "px-[18px] py-4",
        className,
      )}
      {...props}
    />
  );
}

/**
 * A panel's title row: 15/700 on the left, a muted stamp or a link on the
 * right. `align` matches the handoff's two variants — baseline where the
 * right side is text, center where it is a pill or button.
 */
export function PanelHeader({
  title,
  meta,
  align = "baseline",
  className,
}: {
  title: React.ReactNode;
  meta?: React.ReactNode;
  align?: "baseline" | "center";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex justify-between gap-3",
        align === "baseline" ? "items-baseline" : "flex-wrap items-center",
        className,
      )}
    >
      {typeof title === "string" ? (
        <p className="text-[15px] font-bold text-foreground">{title}</p>
      ) : (
        title
      )}
      {meta}
    </div>
  );
}

/** The muted right-hand stamp in a panel header ("2 of 6 complete"). */
export function PanelMeta({ children }: { children: React.ReactNode }) {
  return <p className="text-[12px] font-semibold text-muted-foreground">{children}</p>;
}

/* -------------------------------------------------------------------------
 * Pills
 * ---------------------------------------------------------------------- */

export type PillTone =
  | "neutral"
  | "success"
  | "warning"
  | "danger"
  | "accent"
  | "brand"
  | "info";

const PILL_TONE: Record<PillTone, string> = {
  neutral: "bg-[#eef1ef] text-[#5f6e67]",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-destructive-soft text-destructive",
  accent: "bg-accent text-accent-foreground",
  brand: "bg-primary text-white",
  info: "bg-[#f0fafb] text-[#0e7490]",
};

/**
 * The status pill: 11.5/700 in a tinted capsule. `dot` prefixes the leading
 * marker the handoff puts on stage and qualification pills — color always
 * arrives next to a word, never alone.
 */
export function Pill({
  tone = "neutral",
  dot,
  className,
  style,
  children,
}: {
  tone?: PillTone;
  /** Leading dot; `true` inherits the pill's text color, or pass a hex. */
  dot?: boolean | string;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-pill px-[11px] py-[3px] text-[11.5px] font-bold",
        PILL_TONE[tone],
        className,
      )}
      style={style}
    >
      {dot && (
        <span
          aria-hidden
          className="size-[5px] shrink-0 rounded-full"
          style={{ backgroundColor: typeof dot === "string" ? dot : "currentColor" }}
        />
      )}
      {children}
    </span>
  );
}

/**
 * A pill in an arbitrary stage color — used where the tint/hue pair comes from
 * lib/advisor/discoveryStages rather than the semantic tones above.
 */
export function StagePill({
  color,
  tint,
  label,
  className,
}: {
  color: string;
  tint: string;
  label: string;
  className?: string;
}) {
  return (
    <Pill dot={color} className={className} style={{ backgroundColor: tint, color }}>
      {label}
    </Pill>
  );
}

/* -------------------------------------------------------------------------
 * Tables
 * ---------------------------------------------------------------------- */

/**
 * Tables are a shared CSS grid rather than a <table>: `columns` is the same
 * grid template on the header and on every row, so nothing drifts out of
 * alignment, and each cell stays free to hold a pill or a button.
 */

/** The uppercase header row: 10.5/800, tracked out, over a firmer hairline. */
export function GridHead({
  columns,
  className,
  children,
}: {
  columns: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "grid items-center gap-x-3.5 border-b border-border py-[11px] text-[10.5px] font-extrabold uppercase tracking-[0.11em] text-muted-foreground",
        className,
      )}
      style={{ gridTemplateColumns: columns }}
    >
      {children}
    </div>
  );
}

/** A body row on the same grid, hairlined off from the next one. */
export function GridRow({
  columns,
  last = false,
  className,
  children,
}: {
  columns: string;
  /** Drops the bottom hairline on the final row. */
  last?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "grid items-center gap-x-3.5 py-[11px]",
        !last && "border-b border-border-soft",
        className,
      )}
      style={{ gridTemplateColumns: columns }}
    >
      {children}
    </div>
  );
}

/**
 * The two-line name cell every table opens with: a bold link over a truncated
 * muted second line (usually the email).
 */
export function NameCell({
  href,
  name,
  sub,
}: {
  href?: string;
  name: string;
  sub?: string | null;
}) {
  return (
    <span className="min-w-0">
      {href ? (
        <a
          href={href}
          className="block truncate text-[13.5px] font-bold text-foreground hover:underline"
        >
          {name}
        </a>
      ) : (
        <span className="block truncate text-[13.5px] font-bold text-foreground">{name}</span>
      )}
      {sub && <span className="block truncate text-[12px] font-medium text-faint-foreground">{sub}</span>}
    </span>
  );
}

/** A two-line cell: a bold value over a muted qualifier ("1m ago" / "joined …"). */
export function StackCell({ value, sub }: { value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <span className="min-w-0">
      <span className="block truncate text-[12.5px] font-bold text-foreground">{value}</span>
      {sub && <span className="block truncate text-[11.5px] font-medium text-faint-foreground">{sub}</span>}
    </span>
  );
}

/** The em-dash used wherever a value was never collected. */
export function Empty({ children = "—" }: { children?: React.ReactNode }) {
  return <span className="text-[12.5px] font-medium text-ghost-foreground">{children}</span>;
}

/* -------------------------------------------------------------------------
 * Misc
 * ---------------------------------------------------------------------- */

/** A dotted-leader fact row: muted label left, bold value right. */
export function LeaderRow({
  label,
  value,
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex items-center justify-between gap-3.5 border-b border-dotted border-border-leader py-2 last:border-b-0",
        className,
      )}
    >
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-bold text-foreground">{value}</span>
    </span>
  );
}

/** The small uppercase overline above a group of cards ("PIPELINE STAGES"). */
export function Overline({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        "text-[11px] font-extrabold uppercase tracking-[0.13em] text-muted-foreground",
        className,
      )}
    >
      {children}
    </p>
  );
}

/**
 * The v3 tint/ink pairs used for initials badges. Deterministic per name, so
 * the same person always wears the same color and a list stays scannable.
 */
const BADGE_PALETTE = [
  "bg-primary-soft text-primary",
  "bg-[#fff6d9] text-accent-strong",
  "bg-[#f0fafb] text-[#0e7490]",
  "bg-[#f3eeff] text-[#6d28d9]",
] as const;

export function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

/** A round initials badge in one of the four v3 tints, keyed to the name. */
export function InitialsBadge({ name, className }: { name: string; className?: string }) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;

  return (
    <span
      aria-hidden
      className={cn(
        "flex size-[30px] shrink-0 items-center justify-center rounded-full text-[10.5px] font-extrabold",
        BADGE_PALETTE[hash % BADGE_PALETTE.length],
        className,
      )}
    >
      {initialsOf(name)}
    </span>
  );
}

/**
 * A KPI card led by a 4px bar in the metric's own color — the Portal Admin
 * variant of a stat card, where the color IS the category and there's no icon
 * to carry it.
 */
export function TopBarStat({
  label,
  value,
  footnote,
  color,
  /** Values that are just counts stay ink; a metric with a hue owns it. */
  colorValue = true,
}: {
  label: string;
  value: string;
  footnote: React.ReactNode;
  color: string;
  colorValue?: boolean;
}) {
  const empty = value === "—";
  return (
    <Panel padded={false} className="relative overflow-hidden px-[18px] pb-[13px] pt-[15px]">
      <span aria-hidden className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: color }} />
      <p className="mt-1 text-[10.5px] font-extrabold uppercase tracking-[0.11em] text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "tabular mt-1.5 font-extrabold",
          empty ? "text-[20px] text-ghost-foreground" : "text-[27px]",
        )}
        style={!empty && colorValue ? { color } : undefined}
      >
        {value}
      </p>
      <p className="mt-[5px] text-[12px] font-semibold text-muted-foreground">{footnote}</p>
    </Panel>
  );
}

/**
 * The cream callout the handoff uses for anything awaiting the advisor: the
 * FDD row, the review queue entry, the pinned note, the census failure.
 */
export function AccentNote({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[11px] border border-accent-soft-border bg-accent-soft px-3.5 py-2.5",
        className,
      )}
      {...props}
    />
  );
}
