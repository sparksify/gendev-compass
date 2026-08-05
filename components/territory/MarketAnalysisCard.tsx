"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { STATUS_META } from "./statusMeta";
import { ConfidenceMeter } from "./ConfidenceMeter";
import { useCountUp } from "./useCountUp";
import { TrendingUp, TrendingDown } from "lucide-react";
import type { TerritoryEvaluationResult } from "@/types/territory";

function formatCheckedAt(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function StatTile({ label, value, prefix = "", suffix = "" }: { label: string; value: number; prefix?: string; suffix?: string }) {
  const animated = useCountUp(value);
  return (
    <div className="rounded-lg border border-border-soft bg-surface px-3.5 py-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-[19px] font-bold tabular-nums text-foreground">
        {prefix}
        {animated.toLocaleString()}
        {suffix}
      </p>
    </div>
  );
}

/**
 * "Market Analysis" — the institutional replacement for the old Market
 * Snapshot: animated stat tiles built ONLY from real loaded data (Census
 * ACS via the admin import), a growth indicator, the availability signal
 * meter, and provenance. Fields with no real data are omitted, never
 * fabricated.
 */
export function MarketAnalysisCard({ result }: { result: TerritoryEvaluationResult }) {
  const meta = STATUS_META[result.status];
  const { location, evaluation, marketData } = result;
  const growth = marketData.populationGrowthPct ?? null;
  const hasAnyDemographics =
    marketData.population != null || marketData.households != null || marketData.medianHouseholdIncome != null;

  return (
    <Card className="ti-fade-up">
      <div className="flex items-start justify-between gap-3 px-5 pt-5">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-faint-foreground">
            Market Analysis
          </p>
          <p className="mt-1 truncate text-[16px] font-bold text-foreground">
            {location.displayName ?? location.query}
          </p>
        </div>
        <Badge className={meta.badgeClass}>
          <meta.icon className="size-3" strokeWidth={2} />
          {meta.label}
        </Badge>
      </div>

      <div className="px-5 pt-4">
        <ConfidenceMeter result={result} />
      </div>

      <div className="grid grid-cols-2 gap-2.5 px-5 pt-4">
        {marketData.population != null && <StatTile label="Population" value={marketData.population} />}
        {marketData.households != null && <StatTile label="Households" value={marketData.households} />}
        {marketData.medianHouseholdIncome != null && (
          <StatTile label="Median household income" value={marketData.medianHouseholdIncome} prefix="$" />
        )}
        {growth != null && (
          <div className="rounded-lg border border-border-soft bg-surface px-3.5 py-3">
            <p className="text-[11px] text-muted-foreground">Population growth (5 yr)</p>
            <p
              className={`mt-0.5 inline-flex items-center gap-1 text-[19px] font-bold tabular-nums ${
                growth >= 0 ? "text-success" : "text-destructive"
              }`}
            >
              {growth >= 0 ? (
                <TrendingUp className="size-4" strokeWidth={2} />
              ) : (
                <TrendingDown className="size-4" strokeWidth={2} />
              )}
              {growth > 0 ? "+" : ""}
              {growth.toFixed(1)}%
            </p>
          </div>
        )}
      </div>

      <dl className="grid grid-cols-3 gap-x-4 gap-y-3 px-5 py-4 text-[13px]">
        {location.stateCode && (
          <div>
            <dt className="text-[11px] text-muted-foreground">State</dt>
            <dd className="mt-0.5 font-medium text-foreground">{location.stateCode}</dd>
          </div>
        )}
        {evaluation.radiusMiles > 0 && (
          <div>
            <dt className="text-[11px] text-muted-foreground">Radius</dt>
            <dd className="mt-0.5 font-medium text-foreground">{evaluation.radiusMiles} mi</dd>
          </div>
        )}
        {evaluation.zipCodes.length > 0 && (
          <div>
            <dt className="text-[11px] text-muted-foreground">ZIPs reviewed</dt>
            <dd className="mt-0.5 font-medium text-foreground">{evaluation.zipCodes.length}</dd>
          </div>
        )}
      </dl>

      <div className="border-t border-border-soft px-5 py-3">
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Checked {formatCheckedAt(result.checkedAt)}
          {hasAnyDemographics && marketData.source && <> · Demographics: {marketData.source}</>}
        </p>
      </div>
    </Card>
  );
}
