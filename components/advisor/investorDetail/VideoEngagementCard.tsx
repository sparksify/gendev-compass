import { Clock, Play, PlayCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Disclosure } from "./Disclosure";
import { formatDateTime, formatWatchTime } from "@/lib/advisor/format";
import type { VideoProgressRecord } from "@/types/portal";

function DonutStat({ percent }: { percent: number }) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(100, Math.max(0, percent));
  const offset = circumference * (1 - clamped / 100);

  return (
    <div className="relative flex size-[132px] shrink-0 items-center justify-center">
      <svg viewBox="0 0 100 100" className="size-full -rotate-90">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="var(--border-soft)" strokeWidth="9" />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="var(--primary)"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-2xl font-semibold text-foreground">{Math.round(clamped)}%</span>
        <span className="text-[11px] text-muted-foreground">Watched</span>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="size-3.5 shrink-0 text-muted-foreground" />
      <div>
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className="text-sm font-medium text-foreground">{value}</p>
      </div>
    </div>
  );
}

/**
 * The one visualization kept front and center per the redesign brief — a
 * donut of percent watched, with the supporting numbers as plain stats
 * rather than a second chart or an engagement score.
 */
export function VideoEngagementCard({ video }: { video: VideoProgressRecord | null }) {
  return (
    <Card className="h-full rounded-2xl">
      <CardContent className="p-6">
        <p className="text-sm font-semibold text-foreground">Video Engagement</p>
        {video ? (
          <div className="mt-4 flex flex-col items-center gap-4">
            <DonutStat percent={video.highest_percent_watched} />
            <div className="grid w-full grid-cols-1 gap-3">
              <Stat icon={Clock} label="Total Watch Time" value={formatWatchTime(video.accumulated_seconds_watched)} />
              <Stat icon={Play} label="Play Count" value={String(video.play_count)} />
              <Stat icon={PlayCircle} label="Last Played" value={formatDateTime(video.last_event_at)} />
            </div>
            <Disclosure summary="View Video Activity" className="w-full" defaultOpen={false}>
              <div className="space-y-2">
                <Stat icon={Clock} label="First Played" value={formatDateTime(video.first_played_at)} />
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground">Completed</span>
                  <Badge variant={video.completed ? "success" : "neutral"}>{video.completed ? "Yes" : "No"}</Badge>
                </div>
              </div>
            </Disclosure>
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">No video activity yet.</p>
        )}
      </CardContent>
    </Card>
  );
}
