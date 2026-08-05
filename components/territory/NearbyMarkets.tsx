"use client";

import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { TerritoryAlternative } from "@/types/territory";

/**
 * Opportunity cards for nearby markets that screened as available. Clicking
 * one runs a full new search (the map flies there and every panel updates).
 * Only alternatives the evaluator already screened as AVAILABLE ever appear
 * here — no invented ratings.
 */
export function NearbyMarkets({
  alternatives,
  disabled,
  onSelect,
}: {
  alternatives: TerritoryAlternative[];
  disabled: boolean;
  onSelect: (alternative: TerritoryAlternative) => void;
}) {
  if (alternatives.length === 0) return null;

  return (
    <Card className="ti-fade-up p-5" style={{ animationDelay: "240ms" }}>
      <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-faint-foreground">
        Nearby Markets
      </p>
      <p className="mt-1 text-[12px] text-muted-foreground">
        Screened as open in current records — select one to analyze it.
      </p>
      <div className="mt-3 space-y-2">
        {alternatives.map((alternative) => (
          <button
            key={`${alternative.label}-${alternative.zipCode ?? ""}`}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(alternative)}
            className="group flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-card px-3.5 py-2.5 text-left transition-colors hover:border-primary-soft-border hover:bg-primary-soft/40 disabled:opacity-50"
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <CheckCircle2 className="size-4 shrink-0 text-success" strokeWidth={2} />
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-medium text-foreground">
                  {alternative.label}
                </span>
                {alternative.distanceMiles != null && (
                  <span className="block text-[11.5px] text-muted-foreground">
                    {alternative.distanceMiles} miles away · Appears available
                  </span>
                )}
              </span>
            </span>
            <ArrowRight
              className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
              strokeWidth={2}
            />
          </button>
        ))}
      </div>
    </Card>
  );
}
