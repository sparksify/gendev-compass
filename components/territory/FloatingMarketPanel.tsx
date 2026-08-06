"use client";

import { STATUS_META } from "./statusMeta";
import { availabilitySignal } from "@/lib/territory/briefing";
import { useCountUp } from "./useCountUp";
import { TrendingDown, TrendingUp } from "lucide-react";
import type { TerritoryEvaluationResult } from "@/types/territory";

function toneClasses(percent: number): { bar: string; text: string } {
  if (percent >= 75) return { bar: "bg-success", text: "text-success" };
  if (percent >= 40) return { bar: "bg-[#d97706]", text: "text-[#92400e]" };
  return { bar: "bg-destructive", text: "text-destructive" };
}

function CountUpValue({ value, prefix = "" }: { value: number; prefix?: string }) {
  const animated = useCountUp(value);
  return (
    <>
      {prefix}
      {animated.toLocaleString()}
    </>
  );
}

/**
 * The Market Analysis panel that floats over the map (Google Maps
 * navigation-info style). Hierarchy is decision-first: the availability
 * verdict is the largest element, the signal explanation supports it, and
 * the confidence percentage plays a supporting role rather than dominating.
 * Only real loaded data is shown; missing rows are omitted, never
 * fabricated.
 */
export function FloatingMarketPanel({ result }: { result: TerritoryEvaluationResult }) {
  const meta = STATUS_META[result.status];
  const signal = availabilitySignal(result);
  const tone = toneClasses(signal.percent);
  const animatedPercent = useCountUp(signal.percent);
  const { location, evaluation, marketData } = result;
  const growth = marketData.populationGrowthPct ?? null;

  const rows: Array<{ label: string; content: React.ReactNode }> = [];
  if (marketData.population != null) {
    rows.push({ label: "Population", content: <CountUpValue value={marketData.population} /> });
  }
  if (marketData.medianHouseholdIncome != null) {
    rows.push({
      label: "Median income",
      content: <CountUpValue value={marketData.medianHouseholdIncome} prefix="$" />,
    });
  }
  if (growth != null) {
    rows.push({
      label: "Growth (5 yr)",
      content: (
        <span className={`inline-flex items-center gap-1 ${growth >= 0 ? "text-success" : "text-destructive"}`}>
          {growth >= 0 ? (
            <TrendingUp className="size-3.5" strokeWidth={2} />
          ) : (
            <TrendingDown className="size-3.5" strokeWidth={2} />
          )}
          {growth > 0 ? "+" : ""}
          {growth.toFixed(1)}%
        </span>
      ),
    });
  }
  if (evaluation.radiusMiles > 0) {
    rows.push({ label: "Radius", content: <>{evaluation.radiusMiles} mi</> });
  }

  return (
    <div className="ti-fade-up w-[290px] overflow-hidden rounded-card border border-border bg-card/95 shadow-lg backdrop-blur-sm">
      <div className="px-4 pt-3.5">
        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-faint-foreground">
          Market Analysis
        </p>
        <p className="mt-0.5 truncate text-[12.5px] font-medium text-secondary-foreground">
          {location.displayName ?? location.query}
        </p>

        {/* The decision leads. */}
        <p className={`mt-2 inline-flex items-center gap-1.5 text-[17px] font-bold leading-tight ${tone.text}`}>
          <meta.icon className="size-4.5 shrink-0" strokeWidth={2.2} />
          {meta.label}
        </p>
        <p className="mt-1 text-[11.5px] leading-snug text-muted-foreground">
          <span className="font-medium text-secondary-foreground">{signal.label}.</span> {signal.basis}
        </p>

        {/* Confidence supports the decision — it doesn't dominate it. */}
        <div className="mt-2.5 flex items-center gap-2.5">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface">
            <div
              className={`ti-meter-bar h-full rounded-full ${tone.bar}`}
              style={{ width: `${signal.percent}%` }}
              role="meter"
              aria-valuenow={signal.percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={signal.label}
            />
          </div>
          <span className={`shrink-0 text-[11px] font-semibold tabular-nums ${tone.text}`}>
            {animatedPercent}% confidence
          </span>
        </div>
      </div>

      {rows.length > 0 && (
        <dl className="mt-3 divide-y divide-border-soft border-t border-border-soft">
          {rows.map((row) => (
            <div key={row.label} className="flex items-baseline justify-between px-4 py-1.5">
              <dt className="text-[11px] text-muted-foreground">{row.label}</dt>
              <dd className="text-[12.5px] font-semibold tabular-nums text-foreground">{row.content}</dd>
            </div>
          ))}
        </dl>
      )}
      {marketData.source && (
        <p className="border-t border-border-soft px-4 py-2 text-[10px] leading-snug text-muted-foreground">
          {marketData.source}
        </p>
      )}
    </div>
  );
}
