"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
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
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/**
 * The clients table with the slide-in Client Details drawer. Clicking a row
 * selects it (left blue bar + tinted bg) and opens the 400px panel beside
 * the list; at narrow widths the panel overlays instead.
 */
export function ClientsWithPanel({ rows }: { rows: ClientListRow[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <div className="flex items-start gap-4">
      {/* Table card */}
      <div className="min-w-0 flex-1 overflow-hidden rounded-card border border-border bg-card shadow-card">
        <div className="overflow-x-auto">
          <div className="min-w-[560px]">
            {/* Header */}
            <div className="grid grid-cols-[minmax(170px,1.5fr)_minmax(110px,1.2fr)_minmax(96px,auto)_minmax(76px,0.8fr)_76px] items-center gap-3 border-b border-border-soft px-4 py-2.5 text-[11.5px] font-bold text-muted-foreground">
              <span>Name</span>
              <span>Brand</span>
              <span>Stage</span>
              <span>Source</span>
              <span className="text-right">Territories</span>
            </div>
            {rows.length === 0 && (
              <p className="px-4 py-8 text-center text-[13px] text-muted-foreground">
                No clients match.
              </p>
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
                    "relative grid w-full grid-cols-[minmax(170px,1.5fr)_minmax(110px,1.2fr)_minmax(96px,auto)_minmax(76px,0.8fr)_76px] items-center gap-3 border-b border-[#f1f5f9] px-4 py-2.5 text-left transition-colors last:border-b-0",
                    selected ? "bg-[#f3f7ff]" : "hover:bg-surface-raised",
                  )}
                >
                  {selected && (
                    <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-primary" />
                  )}
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span className="flex size-[34px] shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#3b82f6,#2463eb)] text-xs font-bold text-white">
                      {initials(row.name)}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[13.5px] font-bold text-foreground">
                        {row.name}
                      </span>
                      <span className="block truncate text-[11.5px] text-faint-foreground">{row.email}</span>
                    </span>
                  </span>
                  <span className="truncate text-[12.5px] font-semibold text-secondary-foreground">
                    {row.brandName ?? "—"}
                  </span>
                  <span>
                    <span
                      className={cn(
                        "inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                        PILL_CLASS[stage.tone],
                      )}
                    >
                      {stage.label}
                    </span>
                  </span>
                  <span className="truncate text-[12.5px] text-muted-foreground">{row.source ?? "—"}</span>
                  <span className="text-right text-[13px] font-bold text-foreground">
                    {row.territories ?? "—"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Panel: side-by-side on xl, overlay below */}
      {selectedId && (
        <>
          {/* Overlay backdrop for narrow widths */}
          <div
            aria-hidden
            onClick={() => setSelectedId(null)}
            className="fixed inset-0 z-30 bg-[#0f172a]/20 xl:hidden"
          />
          <div className="fixed inset-y-0 right-0 z-40 w-[400px] max-w-[92vw] border-l border-border shadow-[-8px_0_24px_rgb(15_23_42/0.06)] xl:sticky xl:top-[72px] xl:z-auto xl:h-[calc(100vh-88px)] xl:w-[400px] xl:shrink-0 xl:overflow-hidden xl:rounded-card xl:border xl:shadow-card">
            <ClientDetailsPanel clientId={selectedId} onClose={() => setSelectedId(null)} />
          </div>
        </>
      )}
    </div>
  );
}
