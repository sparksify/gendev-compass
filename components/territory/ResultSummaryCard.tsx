import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { STATUS_META } from "./statusMeta";
import type { TerritoryEvaluationResult } from "@/types/territory";

function formatCheckedAt(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

interface ResultSummaryCardProps {
  result: TerritoryEvaluationResult;
}

/** The factual "Market Snapshot" — availability plus whatever demographic data exists, never fabricated. */
export function ResultSummaryCard({ result }: ResultSummaryCardProps) {
  const meta = STATUS_META[result.status];
  const { location, evaluation, marketData } = result;

  return (
    <Card>
      <div className="flex items-start justify-between gap-3 px-5 pt-5">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-faint-foreground">
            Market Snapshot
          </p>
          <p className="mt-1 truncate text-[15.5px] font-bold text-foreground">
            {location.displayName ?? location.query}
          </p>
        </div>
        <Badge className={meta.badgeClass}>
          <meta.icon className="size-3" strokeWidth={2} />
          {meta.label}
        </Badge>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 px-5 py-4 text-[13px]">
        {location.stateCode && (
          <div>
            <dt className="text-[11px] text-muted-foreground">State</dt>
            <dd className="mt-0.5 font-medium text-foreground">{location.stateCode}</dd>
          </div>
        )}
        {evaluation.radiusMiles > 0 && (
          <div>
            <dt className="text-[11px] text-muted-foreground">Evaluated radius</dt>
            <dd className="mt-0.5 font-medium text-foreground">{evaluation.radiusMiles} miles</dd>
          </div>
        )}
        {evaluation.zipCodes.length > 0 && (
          <div>
            <dt className="text-[11px] text-muted-foreground">ZIP codes reviewed</dt>
            <dd className="mt-0.5 font-medium text-foreground">{evaluation.zipCodes.length}</dd>
          </div>
        )}
        {marketData.population != null && (
          <div>
            <dt className="text-[11px] text-muted-foreground">Approx. population</dt>
            <dd className="mt-0.5 font-medium text-foreground">{marketData.population.toLocaleString()}</dd>
          </div>
        )}
        {marketData.households != null && (
          <div>
            <dt className="text-[11px] text-muted-foreground">Approx. households</dt>
            <dd className="mt-0.5 font-medium text-foreground">{marketData.households.toLocaleString()}</dd>
          </div>
        )}
        {marketData.medianHouseholdIncome != null && (
          <div>
            <dt className="text-[11px] text-muted-foreground">Median household income</dt>
            <dd className="mt-0.5 font-medium text-foreground">
              ${marketData.medianHouseholdIncome.toLocaleString()}
            </dd>
          </div>
        )}
        <div className="col-span-2 border-t border-border-soft pt-3">
          <dt className="text-[11px] text-muted-foreground">Checked</dt>
          <dd className="mt-0.5 font-medium text-foreground">{formatCheckedAt(result.checkedAt)}</dd>
        </div>
      </dl>
    </Card>
  );
}
