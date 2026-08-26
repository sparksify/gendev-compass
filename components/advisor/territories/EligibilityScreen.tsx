"use client";

import { useState } from "react";
import { PageBody, PageHeader, SectionRule } from "@/components/advisor/PageHeader";
import { INK_BUTTON } from "@/components/advisor/controls";
import { TerritoryTabs } from "@/components/advisor/territories/TerritoryTabs";
import { EligibilityGrid } from "@/components/advisor/territories/EligibilityGrid";
import { STATUS_META } from "@/components/territory/statusMeta";
import { SIGNAL, DISCOVERY_STAGES } from "@/lib/advisor/discoveryStages";
import type { BrandStateEligibilityRecord, TerritoryResultStatus } from "@/types/territory";

export interface RecentSearch {
  id: string;
  market: string;
  prospect: string | null;
  status: TerritoryResultStatus;
}

/** The five outcomes the 7-day breakdown bar splits into. */
const OUTCOME_TONES: Record<TerritoryResultStatus, { color: string; short: string }> = {
  AVAILABLE: { color: SIGNAL.success, short: "available" },
  PARTIALLY_AVAILABLE: { color: SIGNAL.warning, short: "limited" },
  UNAVAILABLE: { color: SIGNAL.alert, short: "unavailable" },
  MANUAL_REVIEW: { color: DISCOVERY_STAGES[1].color, short: "manual review" },
  STATE_RESTRICTED: { color: SIGNAL.neutral, short: "state restricted" },
  LOCATION_NOT_FOUND: { color: SIGNAL.neutral, short: "not found" },
  BRAND_NOT_CONFIGURED: { color: SIGNAL.neutral, short: "not set up" },
};

/** Shortened result pill for the recent-searches rail. */
const PILL_LABEL: Partial<Record<TerritoryResultStatus, string>> = {
  AVAILABLE: "Available",
  PARTIALLY_AVAILABLE: "Limited",
  UNAVAILABLE: "Unavailable",
  MANUAL_REVIEW: "Manual Review",
  STATE_RESTRICTED: "State Restricted",
};

/**
 * The State Eligibility tab (handoff mock 7b): the chip grid on the left,
 * recent prospect searches and a 7-day outcome breakdown on the right.
 */
export function EligibilityScreen({
  brandId,
  brandName,
  initialRows,
  recentSearches,
  searchTotal,
  outcomes,
  pendingReviews,
}: {
  brandId: string | null;
  brandName: string | null;
  initialRows: BrandStateEligibilityRecord[];
  recentSearches: RecentSearch[];
  searchTotal: number;
  outcomes: Array<{ status: TerritoryResultStatus; count: number }>;
  pendingReviews: number;
}) {
  const [dirtyCount, setDirtyCount] = useState(0);
  const [saveSignal, setSaveSignal] = useState(0);

  const outcomeTotal = outcomes.reduce((sum, entry) => sum + entry.count, 0);

  return (
    <>
      <PageHeader
        title="Territory Advisor"
        subtitle={brandName ? `${brandName} · state eligibility` : "State eligibility"}
        tabs={<TerritoryTabs pendingReviews={pendingReviews} />}
        actions={
          brandId ? (
            <button
              type="button"
              onClick={() => setSaveSignal((signal) => signal + 1)}
              disabled={dirtyCount === 0}
              className={INK_BUTTON}
            >
              Save changes{dirtyCount > 0 ? ` (${dirtyCount})` : ""}
            </button>
          ) : undefined
        }
      />

      <PageBody>
        {!brandId ? (
          <p className="text-[14.5px] text-muted-foreground">No brands configured yet.</p>
        ) : (
          <div className="grid gap-10 xl:grid-cols-[1.6fr_1fr] [&>*]:min-w-0">
            <EligibilityGrid
              brandId={brandId}
              initialRows={initialRows}
              onDirtyChange={setDirtyCount}
              saveSignal={saveSignal}
            />

            <div>
              <SectionRule
                label="Recent searches"
                meta={<span className="tabular">last 7 days · {searchTotal}</span>}
                className="mb-1.5"
              />
              <div className="flex flex-col text-[14px]">
                {recentSearches.length === 0 && (
                  <p className="py-2 text-muted-foreground">No searches in the last 7 days.</p>
                )}
                {recentSearches.map((search) => {
                  const tone = OUTCOME_TONES[search.status];
                  return (
                    <span
                      key={search.id}
                      className="flex justify-between gap-2.5 border-b border-border-soft py-2.5 last:border-b-0"
                    >
                      <span className="min-w-0">
                        <strong className="font-bold">{search.market}</strong>
                        {search.prospect && ` · ${search.prospect}`}
                      </span>
                      <span
                        className="shrink-0 self-center rounded-full px-2.5 py-[3px] text-[12px] font-bold"
                        style={{ color: tone.color, backgroundColor: `${tone.color}14` }}
                      >
                        {PILL_LABEL[search.status] ?? STATUS_META[search.status].label}
                      </span>
                    </span>
                  );
                })}
              </div>

              <div className="mt-5 rounded-card border border-border px-4 py-3.5">
                <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-faint-foreground">
                  Search outcomes · 7 days
                </p>
                {outcomeTotal === 0 ? (
                  <p className="mt-2 text-[13px] text-muted-foreground">Nothing searched yet.</p>
                ) : (
                  <>
                    <div className="mt-2.5 flex h-2.5 gap-0.5 overflow-hidden rounded-full">
                      {outcomes.map((entry) => (
                        <span
                          key={entry.status}
                          style={{
                            flex: entry.count,
                            backgroundColor: OUTCOME_TONES[entry.status].color,
                          }}
                        />
                      ))}
                    </div>
                    <div className="mt-2.5 flex flex-wrap gap-2.5 text-[12px] text-muted-foreground">
                      {outcomes.map((entry) => (
                        <span key={entry.status}>
                          <strong
                            className="font-bold"
                            style={{ color: OUTCOME_TONES[entry.status].color }}
                          >
                            {entry.count}
                          </strong>{" "}
                          {OUTCOME_TONES[entry.status].short}
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </PageBody>
    </>
  );
}
