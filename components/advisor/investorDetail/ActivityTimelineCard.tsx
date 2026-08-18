"use client";

import { useState } from "react";
import {
  Calendar,
  Circle,
  ClipboardList,
  Eye,
  FileText,
  GitBranch,
  Link2,
  MessageSquare,
  Play,
  UserPlus,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { eventLabel, eventSourceLabel, formatDateTime, formatRelative } from "@/lib/advisor/format";
import { cn } from "@/lib/utils";
import type { PortalEventRecord } from "@/types/analytics";

const PREVIEW_COUNT = 6;

function iconFor(eventName: string): React.ComponentType<{ className?: string }> {
  if (eventName.includes("page") || eventName.includes("view")) return Eye;
  if (eventName.includes("questionnaire")) return ClipboardList;
  if (eventName.includes("video")) return Play;
  if (eventName.includes("portal")) return Link2;
  if (eventName.includes("lead")) return UserPlus;
  if (eventName.includes("stage")) return GitBranch;
  if (eventName.includes("note")) return MessageSquare;
  if (eventName.includes("fdd")) return FileText;
  if (eventName.includes("book") || eventName.includes("appointment") || eventName.includes("consult"))
    return Calendar;
  return Circle;
}

/** "TODAY" for today's events, otherwise "AUG 12". */
function dayLabel(iso: string, now: Date): string {
  const date = new Date(iso);
  if (date.toDateString() === now.toDateString()) return "TODAY";
  return date
    .toLocaleDateString("en-US", { month: "short", day: "numeric" })
    .toUpperCase();
}

export function ActivityTimelineCard({ events }: { events: PortalEventRecord[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? events : events.slice(0, PREVIEW_COUNT);
  const now = new Date();

  let previousDay: string | null = null;

  return (
    <Card className="h-full">
      <CardContent className="px-[15px] py-[13px]">
        <div className="flex items-center justify-between">
          <p className="border-b-2 border-primary pb-[5px] text-[15px] font-bold text-foreground">
            Activity timeline
          </p>
          {events.length > PREVIEW_COUNT && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="text-xs font-semibold text-primary hover:underline"
            >
              {expanded ? "Show recent" : "View all"}
            </button>
          )}
        </div>

        {events.length === 0 ? (
          <p className="mt-2.5 text-[13px] text-muted-foreground">No activity recorded yet.</p>
        ) : (
          <ol className="mt-2.5 flex flex-col gap-2">
            {visible.map((event) => {
              const occurredAt = event.occurred_at ?? event.created_at;
              const label = dayLabel(occurredAt, now);
              const showLabel = label !== previousDay;
              previousDay = label;
              const isToday = label === "TODAY";
              const Icon = iconFor(event.event_name);
              const detail =
                event.event_name === "stage_changed" && event.event_data
                  ? `${String(event.event_data.oldStage ?? "")} → ${String(event.event_data.newStage ?? "")}`
                  : event.event_name.startsWith("video_progress") && event.event_data?.percent
                    ? `${String(event.event_data.percent)}%`
                    : null;

              return (
                <li
                  key={event.id}
                  className="grid grid-cols-[50px_12px_24px_minmax(0,1fr)_auto] items-center gap-x-2.5"
                >
                  <span
                    className={cn(
                      "text-[9.5px] font-bold tracking-[0.08em]",
                      isToday ? "text-success" : "text-faint-foreground",
                    )}
                  >
                    {showLabel ? label : ""}
                  </span>
                  <span
                    aria-hidden
                    className={cn(
                      "size-2 rounded-full",
                      isToday
                        ? "bg-success shadow-[0_0_0_3px_#e8f6ec]"
                        : "bg-primary shadow-[0_0_0_3px_#eff4ff]",
                    )}
                  />
                  <Icon className="size-3.5 text-muted-foreground" />
                  <p className="truncate text-[12.5px] font-medium text-foreground">
                    {eventLabel(event.event_name)}
                    {detail && <span className="ml-1.5 font-normal text-muted-foreground">{detail}</span>}
                  </p>
                  <p
                    className="whitespace-nowrap text-[11px] text-faint-foreground"
                    title={formatDateTime(occurredAt)}
                  >
                    {formatRelative(occurredAt)} · {eventSourceLabel(event.event_source)}
                  </p>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
