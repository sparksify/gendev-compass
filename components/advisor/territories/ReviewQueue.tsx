"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NativeSelect, Textarea } from "@/components/ui/form-fields";
import { TERRITORY_REVIEW_STATUSES, TERRITORY_REVIEW_STATUS_LABELS } from "@/types/territory";
import type { LeadRecord } from "@/types/lead";
import type { TerritoryReviewRequestRecord, TerritoryReviewStatus, TerritorySearchRecord } from "@/types/territory";

interface ReviewRow {
  review: TerritoryReviewRequestRecord;
  lead: LeadRecord | null;
  brandName: string;
  search: TerritorySearchRecord | null;
}

interface ReviewQueueProps {
  rows: ReviewRow[];
  staff: Array<{ id: string; name: string }>;
}

const STATUS_BADGE: Record<TerritoryReviewStatus, string> = {
  new: "bg-primary-soft text-primary",
  in_review: "bg-[#fef3c7] text-[#92400e]",
  contacted: "bg-surface text-muted-foreground",
  approved: "bg-success-soft text-success",
  declined: "bg-destructive/10 text-destructive",
  closed: "bg-surface text-faint-foreground",
};

export function ReviewQueue({ rows: initialRows, staff }: ReviewQueueProps) {
  const [rows, setRows] = useState(initialRows);

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

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{rows.length} review request{rows.length === 1 ? "" : "s"}</p>
      <div className="space-y-3">
        {rows.map(({ review, lead, brandName, search }) => (
          <Card key={review.id}>
            <CardContent className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  {lead ? (
                    <Link href={`/advisor/investors/${lead.id}`} className="font-medium text-primary hover:text-primary-hover">
                      {lead.first_name} {lead.last_name}
                    </Link>
                  ) : (
                    <p className="font-medium text-foreground">Unknown prospect</p>
                  )}
                  <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                    {brandName}
                    {search && <> · {search.normalized_location ?? search.raw_query} · {search.result_status}</>}
                  </p>
                  <p className="text-[11.5px] text-faint-foreground">{new Date(review.created_at).toLocaleString()}</p>
                </div>
                <Badge className={STATUS_BADGE[review.status]}>{TERRITORY_REVIEW_STATUS_LABELS[review.status]}</Badge>
              </div>

              {review.prospect_message && (
                <p className="mt-3 rounded-control border border-border-soft bg-surface p-3 text-[13px] text-foreground">
                  &ldquo;{review.prospect_message}&rdquo;
                </p>
              )}

              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Status</label>
                  <NativeSelect
                    className="!py-1.5 text-xs"
                    value={review.status}
                    onChange={(e) => patch(review.id, { status: e.target.value })}
                  >
                    {TERRITORY_REVIEW_STATUSES.map((s) => (
                      <option key={s} value={s}>{TERRITORY_REVIEW_STATUS_LABELS[s]}</option>
                    ))}
                  </NativeSelect>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Assigned to</label>
                  <NativeSelect
                    className="!py-1.5 text-xs"
                    value={review.assigned_to ?? ""}
                    onChange={(e) => patch(review.id, { assignedTo: e.target.value || null })}
                  >
                    <option value="">Unassigned</option>
                    {staff.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </NativeSelect>
                </div>
              </div>

              <div className="mt-3">
                <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Internal notes</label>
                <Textarea
                  rows={2}
                  defaultValue={review.internal_notes ?? ""}
                  onBlur={(e) => {
                    if (e.target.value !== (review.internal_notes ?? "")) {
                      patch(review.id, { internalNotes: e.target.value });
                    }
                  }}
                />
              </div>
            </CardContent>
          </Card>
        ))}
        {rows.length === 0 && (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">No review requests yet.</CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
