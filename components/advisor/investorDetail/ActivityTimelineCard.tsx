"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { eventLabel, eventSourceLabel, formatDateTime, formatRelative } from "@/lib/advisor/format";
import type { PortalEventRecord } from "@/types/analytics";

const PREVIEW_COUNT = 5;

export function ActivityTimelineCard({ events }: { events: PortalEventRecord[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? events : events.slice(0, PREVIEW_COUNT);

  return (
    <Card className="h-full">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">Activity Timeline</p>
          {events.length > PREVIEW_COUNT && (
            <Button variant="ghost" size="sm" className="h-auto px-2 py-1" onClick={() => setExpanded((v) => !v)}>
              {expanded ? "Show less" : "View All"}
            </Button>
          )}
        </div>

        {events.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No activity recorded yet.</p>
        ) : (
          <ol className="mt-3 space-y-3">
            {visible.map((event) => {
              const detail =
                event.event_name === "stage_changed" && event.event_data
                  ? `${String(event.event_data.oldStage ?? "")} → ${String(event.event_data.newStage ?? "")}`
                  : event.event_name.startsWith("video_progress") && event.event_data?.percent
                    ? `${String(event.event_data.percent)}% watched`
                    : null;
              return (
                <li key={event.id} className="flex gap-2.5 text-sm">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-hidden />
                  <div className="min-w-0">
                    <p className="font-medium leading-tight text-foreground">
                      {eventLabel(event.event_name)}
                      {detail && <span className="ml-1.5 font-normal text-muted-foreground">{detail}</span>}
                    </p>
                    <p
                      className="text-xs text-muted-foreground"
                      title={formatDateTime(event.occurred_at ?? event.created_at)}
                    >
                      {formatRelative(event.occurred_at ?? event.created_at)} ·{" "}
                      {eventSourceLabel(event.event_source)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
