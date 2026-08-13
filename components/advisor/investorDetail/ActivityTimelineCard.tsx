"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { eventLabel, eventSourceLabel, formatDateTime, formatRelative } from "@/lib/advisor/format";
import type { PortalEventRecord } from "@/types/analytics";

const PREVIEW_COUNT = 5;

export function ActivityTimelineCard({ events }: { events: PortalEventRecord[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? events : events.slice(0, PREVIEW_COUNT);

  return (
    <Card className="h-full rounded-2xl">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">Activity Timeline</p>
        </div>

        {events.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No activity recorded yet.</p>
        ) : (
          <ol className="mt-3 border-l border-border-soft pl-4">
            {visible.map((event) => {
              const detail =
                event.event_name === "stage_changed" && event.event_data
                  ? `${String(event.event_data.oldStage ?? "")} → ${String(event.event_data.newStage ?? "")}`
                  : event.event_name.startsWith("video_progress") && event.event_data?.percent
                    ? `${String(event.event_data.percent)}% watched`
                    : null;
              return (
                <li key={event.id} className="relative pb-4 text-sm last:pb-0">
                  <span className="absolute -left-[21px] mt-1.5 size-2 rounded-full bg-primary ring-4 ring-card" aria-hidden />
                  <p className="font-medium leading-tight text-foreground">
                    {eventLabel(event.event_name)}
                    {detail && <span className="ml-1.5 font-normal text-muted-foreground">{detail}</span>}
                  </p>
                  <p
                    className="mt-0.5 text-xs text-muted-foreground"
                    title={formatDateTime(event.occurred_at ?? event.created_at)}
                  >
                    {formatRelative(event.occurred_at ?? event.created_at)} ·{" "}
                    {eventSourceLabel(event.event_source)}
                  </p>
                </li>
              );
            })}
          </ol>
        )}

        {events.length > PREVIEW_COUNT && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mt-1 text-xs font-medium text-primary hover:underline"
          >
            {expanded ? "Show less" : "View Full Timeline →"}
          </button>
        )}
      </CardContent>
    </Card>
  );
}
