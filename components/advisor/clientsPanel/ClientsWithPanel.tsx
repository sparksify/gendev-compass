"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
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
  netWorth: string;
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const GRID =
  "grid-cols-[minmax(190px,1.6fr)_minmax(120px,1fr)_minmax(110px,auto)_minmax(96px,auto)_minmax(120px,1fr)_minmax(120px,1fr)_minmax(90px,0.8fr)_80px]";

/**
 * The clients table with the slide-in Client Details drawer. Clicking a row
 * selects it (left blue bar + tinted bg) and opens the panel, which overlays
 * from the right over the page content; X (or the backdrop) closes it.
 */
export function ClientsWithPanel({ rows }: { rows: ClientListRow[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <>
      {/* Table card */}
      <div className="overflow-hidden rounded-card border border-border bg-card shadow-card">
        <div className="overflow-x-auto">
          <div className="min-w-[960px]">
            {/* Header */}
            <div
              className={cn(
                "grid items-center gap-3 border-b border-border-soft px-4 py-3 text-left text-xs font-bold text-muted-foreground",
                GRID,
              )}
            >
              <span>Name</span>
              <span>Brand</span>
              <span>Stage</span>
              <span>Video</span>
              <span>Liquid Capital</span>
              <span>Net Worth</span>
              <span>Source</span>
              <span className="text-right">Territories</span>
            </div>
            {rows.length === 0 && (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">No clients match.</p>
            )}
            {rows.map((row) => {
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
