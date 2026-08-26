"use client";

import { useState } from "react";
import Link from "next/link";
import { PageBody, PageHeader, SectionRule } from "@/components/advisor/PageHeader";
import { INK_BUTTON, SECONDARY_BUTTON } from "@/components/advisor/controls";
import { TerritoryTabs } from "@/components/advisor/territories/TerritoryTabs";
import { TerritoryRecordsPanel } from "@/components/advisor/territories/TerritoryRecordsPanel";
import { TerritoryReviewRows, type ReviewRow } from "@/components/advisor/territories/ReviewQueue";
import { SIGNAL } from "@/lib/advisor/discoveryStages";
import { cn } from "@/lib/utils";
import type { TerritoryDefinitionRecord, TerritoryStatus } from "@/types/territory";

export interface BrandChip {
  id: string;
  slug: string;
  name: string;
  territoryCount: number;
}

const LEGEND: Array<{ status: TerritoryStatus; label: string; color: string }> = [
  { status: "sold", label: "Sold", color: SIGNAL.alert },
  { status: "reserved", label: "Reserved", color: SIGNAL.warning },
  { status: "available", label: "Open", color: SIGNAL.success },
];

/**
 * The Territory Advisor's Records tab (handoff mock 7a): brand chips and a
 * status legend over the records table, with the review queue's pending
 * rows underneath. Client-side only so the header's "New territory" can
 * open the create form in the body.
 */
export function TerritoryRecordsScreen({
  brands,
  activeBrand,
  territories,
  zipCounts,
  reviewRows,
  staff,
  pendingReviews,
}: {
  brands: BrandChip[];
  activeBrand: BrandChip | null;
  territories: TerritoryDefinitionRecord[];
  zipCounts: Record<string, number>;
  reviewRows: ReviewRow[];
  staff: Array<{ id: string; name: string }>;
  pendingReviews: number;
}) {
  const [showCreate, setShowCreate] = useState(false);

  const counts = LEGEND.map((entry) => ({
    ...entry,
    count: territories.filter((t) =>
      entry.status === "available"
        ? t.status === "available"
        : t.status === entry.status,
    ).length,
  }));

  const reviewQueue = (
    <div>
      <SectionRule
        label="Review queue"
        meta={
          pendingReviews > 0 ? (
            <span className="font-bold" style={{ color: SIGNAL.warning }}>
              {pendingReviews} pending
            </span>
          ) : (
            "nothing pending"
          )
        }
        className="mb-1.5"
      />
      <TerritoryReviewRows rows={reviewRows} staff={staff} limit={5} />
    </div>
  );

  return (
    <>
      <PageHeader
        title="Territory Advisor"
        subtitle="Manage records, eligibility, and prospect search activity"
        tabs={<TerritoryTabs pendingReviews={pendingReviews} />}
        actions={
          activeBrand ? (
            <>
              <a href="#zip-import" className={SECONDARY_BUTTON}>
                Import CSV
              </a>
              <button type="button" onClick={() => setShowCreate(true)} className={INK_BUTTON}>
                New territory
              </button>
            </>
          ) : undefined
        }
      />

      <PageBody className="flex flex-col gap-[26px]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-2">
            {brands.map((brand) => {
              const active = brand.id === activeBrand?.id;
              return (
                <Link
                  key={brand.id}
                  href={`/advisor/territories/records?brand=${brand.slug}`}
                  className={cn(
                    "rounded-full px-[13px] py-1.5 text-[13px] transition-colors",
                    active
                      ? "bg-foreground font-bold text-white"
                      : "border border-border font-semibold text-muted-foreground hover:text-foreground",
                  )}
                >
                  {brand.name} · {brand.territoryCount} territor
                  {brand.territoryCount === 1 ? "y" : "ies"}
                </Link>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-4 text-[13px] text-muted-foreground">
            {counts.map((entry) => (
              <span key={entry.status} className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="size-[7px] rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                {entry.label} · {entry.count}
              </span>
            ))}
          </div>
        </div>

        {!activeBrand ? (
          <>
            <p className="text-[14.5px] text-muted-foreground">
              No brands configured yet. Run{" "}
              <code className="rounded bg-surface-raised px-1 py-0.5">npm run seed:territory</code>{" "}
              or create one via the API to get started.
            </p>
            {reviewQueue}
          </>
        ) : (
          <TerritoryRecordsPanel
            brandId={activeBrand.id}
            initialTerritories={territories}
            initialZipCounts={zipCounts}
            showCreate={showCreate}
            onCloseCreate={() => setShowCreate(false)}
            afterTable={reviewQueue}
          />
        )}
      </PageBody>
    </>
  );
}
