"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, ChevronsUpDown, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate, formatRelative } from "@/lib/advisor/format";
import { MiniVideoRing } from "@/components/advisor/MiniVideoRing";
import { ClientDetailsPanel } from "./ClientDetailsPanel";
import { PILL_CLASS, stagePill } from "./pills";

export interface ClientListRow {
  id: string;
  name: string;
  email: string;
  brandName: string | null;
  stage: string;
  source: string | null;
  territories: number | null;
  /** Highest percent of the overview video watched; null = no activity. */
  videoPercent: number | null;
  videoCompleted: boolean;
  /** Pre-labeled range from the questionnaire, falling back to the lead form. */
  liquidCapital: string;
  /** Ordinal position within the range list — null when unknown — so the
   * column sorts by actual dollar order instead of alphabetically. */
  liquidCapitalRank: number | null;
  netWorth: string;
  netWorthRank: number | null;
  /** When the lead first came in. */
  createdAt: string;
  lastActivityAt: string;
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

type SortKey =
  | "name"
  | "brand"
  | "stage"
  | "video"
  | "liquidCapital"
  | "netWorth"
  | "source"
  | "createdAt"
  | "lastActivityAt"
  | "territories";

interface SortState {
  key: SortKey;
  dir: "asc" | "desc";
}

interface ColumnDef {
  key: SortKey;
  label: string;
  align?: "right";
}

// Text columns default to A→Z; anything where "biggest/most recent first"
// is the useful reading (video watched, capital, dates) defaults to
// descending on its first click.
const DEFAULT_DIR: Record<SortKey, "asc" | "desc"> = {
  name: "asc",
  brand: "asc",
  stage: "asc",
  source: "asc",
  video: "desc",
  liquidCapital: "desc",
  netWorth: "desc",
  territories: "desc",
  createdAt: "desc",
  lastActivityAt: "desc",
};

const COLUMNS: ColumnDef[] = [
  { key: "name", label: "Name" },
  { key: "brand", label: "Brand" },
  { key: "stage", label: "Stage" },
  { key: "video", label: "Video" },
  { key: "liquidCapital", label: "Liquid Capital" },
  { key: "netWorth", label: "Net Worth" },
  { key: "source", label: "Source" },
  { key: "createdAt", label: "Lead Created" },
  { key: "lastActivityAt", label: "Last Activity" },
  { key: "territories", label: "Territories", align: "right" },
];

const GRID =
  "grid-cols-[minmax(190px,1.5fr)_minmax(104px,0.85fr)_minmax(96px,auto)_minmax(88px,auto)_minmax(108px,0.85fr)_minmax(108px,0.85fr)_minmax(84px,0.7fr)_minmax(100px,0.85fr)_minmax(100px,0.85fr)_80px]";

/** Nulls always sort last, regardless of direction — a missing value never
 * jumps to the top just because the sort flipped to descending. */
function compareNullable(a: number | null, b: number | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a - b;
}

function compareRows(a: ClientListRow, b: ClientListRow, key: SortKey): number {
  switch (key) {
    case "name":
      return a.name.localeCompare(b.name);
    case "brand":
      return (a.brandName ?? "").localeCompare(b.brandName ?? "");
    case "stage":
      return stagePill(a.stage).label.localeCompare(stagePill(b.stage).label);
    case "source":
      return (a.source ?? "").localeCompare(b.source ?? "");
    case "video":
      return compareNullable(a.videoPercent, b.videoPercent);
    case "liquidCapital":
      return compareNullable(a.liquidCapitalRank, b.liquidCapitalRank);
    case "netWorth":
      return compareNullable(a.netWorthRank, b.netWorthRank);
    case "territories":
      return compareNullable(a.territories, b.territories);
    case "createdAt":
      return a.createdAt.localeCompare(b.createdAt);
    case "lastActivityAt":
      return a.lastActivityAt.localeCompare(b.lastActivityAt);
    default:
      return 0;
  }
}

function SortableHeader({
  column,
  sort,
  onSort,
}: {
  column: ColumnDef;
  sort: SortState | null;
  onSort: (key: SortKey) => void;
}) {
  const active = sort?.key === column.key;
  const Icon = active ? (sort!.dir === "asc" ? ChevronUp : ChevronDown) : ChevronsUpDown;
  return (
    <button
      type="button"
      onClick={() => onSort(column.key)}
      className={cn(
        "inline-flex items-center gap-1 text-left transition-colors hover:text-secondary-foreground",
        column.align === "right" && "justify-end",
        active && "text-secondary-foreground",
      )}
    >
      {column.label}
      <Icon className={cn("size-3 shrink-0", active ? "text-secondary-foreground" : "text-faint-foreground")} />
    </button>
  );
}

/**
 * The clients table with the slide-in Client Details drawer. Clicking a row
 * selects it (left blue bar + tinted bg) and opens the panel, which overlays
 * from the right over the page content; X (or the backdrop) closes it.
 * Every column header sorts the table client-side; "Reset to Newest"
 * restores the server's default order (most recent activity first).
 */
export function ClientsWithPanel({ rows }: { rows: ClientListRow[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sort, setSort] = useState<SortState | null>(null);

  const sortedRows = useMemo(() => {
    if (!sort) return rows;
    const dir = sort.dir === "desc" ? -1 : 1;
    return [...rows].sort((a, b) => compareRows(a, b, sort.key) * dir);
  }, [rows, sort]);

  function handleSort(key: SortKey) {
    setSort((prev) => {
      if (prev?.key === key) return { key, dir: prev.dir === "asc" ? "desc" : "asc" };
      return { key, dir: DEFAULT_DIR[key] };
    });
  }

  return (
    <>
      <div className="mb-2 flex items-center justify-between px-0.5">
        <p className="text-[12.5px] text-muted-foreground">
          {sort ? (
            <>
              Sorted by <span className="font-semibold text-secondary-foreground">{COLUMNS.find((c) => c.key === sort.key)?.label}</span>{" "}
              ({sort.dir === "asc" ? "low to high" : "high to low"})
            </>
          ) : (
            "Sorted by most recent activity"
          )}
        </p>
        {sort && (
          <button
            type="button"
            onClick={() => setSort(null)}
            className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-primary hover:text-primary-hover"
          >
            <RotateCcw className="size-3.5" />
            Reset to Newest
          </button>
        )}
      </div>

      {/* Table card */}
      <div className="overflow-hidden rounded-card border border-border bg-card shadow-card">
        <div className="overflow-x-auto">
          <div className="min-w-[1180px]">
            {/* Header */}
            <div
              className={cn(
                "grid items-center gap-3 border-b border-border-soft px-4 py-3 text-left text-xs font-bold text-muted-foreground",
                GRID,
              )}
            >
              {COLUMNS.map((column) => (
                <SortableHeader key={column.key} column={column} sort={sort} onSort={handleSort} />
              ))}
            </div>
            {sortedRows.length === 0 && (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">No clients match.</p>
            )}
            {sortedRows.map((row) => {
              const stage = stagePill(row.stage);
              const selected = row.id === selectedId;
              return (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => setSelectedId(selected ? null : row.id)}
                  aria-expanded={selected}
                  className={cn(
                    "relative grid w-full items-center gap-3 border-b border-[#f1f5f9] px-4 py-3 text-left transition-colors last:border-b-0",
                    GRID,
                    selected ? "bg-[#f3f7ff]" : "hover:bg-surface-raised",
                  )}
                >
                  {selected && (
                    <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-primary" />
                  )}
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#3b82f6,#2463eb)] text-[13px] font-bold text-white">
                      {initials(row.name)}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[14.5px] font-bold text-foreground">
                        {row.name}
                      </span>
                      <span className="block truncate text-xs text-faint-foreground">{row.email}</span>
                    </span>
                  </span>
                  <span className="truncate text-[13px] font-semibold text-secondary-foreground">
                    {row.brandName ?? "—"}
                  </span>
                  <span>
                    <span
                      className={cn(
                        "inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold",
                        PILL_CLASS[stage.tone],
                      )}
                    >
                      {stage.label}
                    </span>
                  </span>
                  <span>
                    {row.videoPercent !== null ? (
                      <MiniVideoRing percent={row.videoPercent} completed={row.videoCompleted} />
                    ) : (
                      <span className="text-[13px] text-faint-foreground">—</span>
                    )}
                  </span>
                  <span className="truncate text-[13px] font-semibold text-secondary-foreground">
                    {row.liquidCapital}
                  </span>
                  <span className="truncate text-[13px] font-semibold text-secondary-foreground">
                    {row.netWorth}
                  </span>
                  <span className="truncate text-[13px] text-muted-foreground">{row.source ?? "—"}</span>
                  <span className="truncate text-[13px] text-muted-foreground">{formatDate(row.createdAt)}</span>
                  <span className="truncate text-[13px] text-muted-foreground">
                    {formatRelative(row.lastActivityAt)}
                  </span>
                  <span className="text-right text-sm font-bold text-foreground">
                    {row.territories ?? "—"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Panel: overlays the page from the right at every width. */}
      {selectedId && (
        <>
          <div
            aria-hidden
            onClick={() => setSelectedId(null)}
            className="fixed inset-0 z-30 bg-[#0f172a]/20"
          />
          <div className="fixed inset-y-0 right-0 z-40 w-[440px] max-w-[94vw] border-l border-border shadow-[-8px_0_24px_rgb(15_23_42/0.1)]">
            <ClientDetailsPanel clientId={selectedId} onClose={() => setSelectedId(null)} />
          </div>
        </>
      )}
    </>
  );
}
