"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Textarea } from "@/components/ui/form-fields";
import { INK_BUTTON_SM } from "@/components/advisor/controls";
import { STATUS_META } from "@/components/territory/statusMeta";
import { SIGNAL, DISCOVERY_STAGES } from "@/lib/advisor/discoveryStages";
import {
  TERRITORY_REVIEW_STATUSES,
  TERRITORY_REVIEW_STATUS_LABELS,
  type TerritoryResultStatus,
  type TerritoryReviewRequestRecord,
  type TerritoryReviewStatus,
  type TerritorySearchRecord,
} from "@/types/territory";
import type { LeadRecord } from "@/types/lead";

export interface ReviewRow {
  review: TerritoryReviewRequestRecord;
  lead: LeadRecord | null;
  brandName: string;
  search: TerritorySearchRecord | null;
}

/** The result colors the handoff names, keyed to the shared status labels. */
const RESULT_COLOR: Record<TerritoryResultStatus, string> = {
  AVAILABLE: SIGNAL.success,
  PARTIALLY_AVAILABLE: SIGNAL.warning,
  UNAVAILABLE: SIGNAL.alert,
  MANUAL_REVIEW: DISCOVERY_STAGES[1].color,
  STATE_RESTRICTED: SIGNAL.neutral,
  LOCATION_NOT_FOUND: SIGNAL.neutral,
  BRAND_NOT_CONFIGURED: SIGNAL.neutral,
};

function reviewDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * The review queue as flat rows (handoff mock 7a): "Name — Market (ZIP)"
 * over the search result, with the assignee dropdown and a Review button on
 * the right. Used both on its own tab and as a preview under the records
 * table.
 */
export function TerritoryReviewRows({
  rows: initialRows,
  staff,
  limit,
}: {
  rows: ReviewRow[];
  staff: Array<{ id: string; name: string }>;
  /** Cap for the preview under the records table. */
  limit?: number;
}) {
  const [rows, setRows] = useState(initialRows);
  const [openId, setOpenId] = useState<string | null>(null);

  async function patch(id: string, body: Record<string, unknown>) {
    const response = await fetch(`/api/advisor/territories/reviews/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (data.success) {
      setRows((prev) => prev.map((r) => (r.review.id === id ? { ...r, review: data.review } : r)));
    }
  }

  const visible = limit ? rows.slice(0, limit) : rows;

  if (visible.length === 0) {
    return <p className="py-3 text-[12.5px] text-muted-foreground">No review requests.</p>;
  }

  return (
    <div>
      {visible.map(({ review, lead, brandName, search }) => {
        const status = search?.result_status as TerritoryResultStatus | undefined;
        const market = search?.normalized_location ?? search?.raw_query ?? brandName;
        const open = openId === review.id;
        return (
          <div key={review.id} className="border-b border-border-soft last:border-b-0">
            <div className="flex flex-wrap items-center gap-3.5 py-3">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-bold text-foreground">
                  {lead ? (
                    <Link href={`/advisor/investors/${lead.id}`} className="hover:underline">
                      {lead.first_name} {lead.last_name}
                    </Link>
                  ) : (
                    "Unknown prospect"
                  )}
                  {market && <> — {market}</>}
                </span>
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                  Searched {reviewDate(review.created_at)} · result:{" "}
                  {status ? (
                    <strong className="font-bold" style={{ color: RESULT_COLOR[status] }}>
                      {STATUS_META[status].label}
                    </strong>
                  ) : (
                    <strong className="font-bold">{TERRITORY_REVIEW_STATUS_LABELS[review.status]}</strong>
                  )}
                  {review.prospect_message && <> — “{review.prospect_message}”</>}
                </span>
              </span>

              <span className="relative inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                Assign:{" "}
                <span className="relative inline-flex items-center pr-4 font-bold text-foreground">
                  <select
                    value={review.assigned_to ?? ""}
                    onChange={(event) => patch(review.id, { assignedTo: event.target.value || null })}
                    aria-label="Assign reviewer"
                    className="absolute inset-0 cursor-pointer appearance-none bg-transparent text-transparent outline-none"
                  >
                    <option value="">Unassigned</option>
                    {staff.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name}
                      </option>
                    ))}
                  </select>
                  <span className="pointer-events-none">
                    {staff.find((member) => member.id === review.assigned_to)?.name.split(" ")[0] ??
                      "Unassigned"}
                  </span>
                  <ChevronDown className="pointer-events-none absolute right-0 size-3" />
                </span>
              </span>

              <button
                type="button"
                onClick={() => setOpenId(open ? null : review.id)}
                aria-expanded={open}
                className={INK_BUTTON_SM}
              >
                Review
              </button>
            </div>

            {open && (
              <div className="grid gap-3 pb-4 sm:grid-cols-2">
                <label className="text-[11px] font-medium text-muted-foreground">
                  Status
                  <select
                    value={review.status}
                    onChange={(event) => patch(review.id, { status: event.target.value })}
                    className="mt-1.5 block w-full rounded-control border border-border bg-card px-3 py-1.5 text-xs text-foreground"
                  >
                    {TERRITORY_REVIEW_STATUSES.map((option: TerritoryReviewStatus) => (
                      <option key={option} value={option}>
                        {TERRITORY_REVIEW_STATUS_LABELS[option]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-[11px] font-medium text-muted-foreground sm:col-span-2">
                  Internal notes
                  <Textarea
                    rows={2}
                    className="mt-1.5"
                    defaultValue={review.internal_notes ?? ""}
                    onBlur={(event) => {
                      if (event.target.value !== (review.internal_notes ?? "")) {
                        patch(review.id, { internalNotes: event.target.value });
                      }
                    }}
                  />
                </label>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** The standalone Review Queue tab. */
export function ReviewQueue({
  rows,
  staff,
}: {
  rows: ReviewRow[];
  staff: Array<{ id: string; name: string }>;
}) {
  return <TerritoryReviewRows rows={rows} staff={staff} />;
}
