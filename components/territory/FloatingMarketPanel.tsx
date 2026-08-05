"use client";

import { Badge } from "@/components/ui/badge";
import { STATUS_META } from "./statusMeta";
import { ConfidenceMeter } from "./ConfidenceMeter";
import { useCountUp } from "./useCountUp";
import { TrendingDown, TrendingUp } from "lucide-react";
import type { TerritoryEvaluationResult } from "@/types/territory";

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
 * navigation-info style): market, availability, the confidence signal, and
 * the key figures — updating with every search. Only real loaded data is
 * shown; missing rows are omitted, never fabricated.
 */
export function FloatingMarketPanel({ result }: { result: TerritoryEvaluationResult }) {
  const meta = STATUS_META[result.status];
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
  if (evaluation.zipCodes.length > 0) {
    rows.push({ label: "ZIPs reviewed", content: <>{evaluation.zipCodes.length}</> });
  }

  return (
    <div className="ti-fade-up w-[290px] overflow-hidden rounded-card border border-border bg-card/95 shadow-lg backdrop-blur-sm">
      <div className="px-4 pt-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-faint-foreground">
              Market Analysis
            </p>
            <p className="mt-0.5 truncate text-[14px] font-bold text-foreground">
              {location.displayName ?? location.query}
            </p>
          </div>
          <Badge className={meta.badgeClass}>
            <meta.icon className="size-3" strokeWidth={2} />
            {meta.label}
          </Badge>
        </div>
        <div className="mt-2.5">
          <ConfidenceMeter result={result} compact />
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
