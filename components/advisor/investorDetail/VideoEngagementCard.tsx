import { Clock, Play } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
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
 * donut of percent watched, with the supporting numbers laid out beside it
 * (not stacked beneath, and not hidden behind a disclosure) so the full
 * picture reads at a glance.
 */
export function VideoEngagementCard({ video }: { video: VideoProgressRecord | null }) {
  const clampedPercent = video ? Math.min(100, Math.max(0, video.highest_percent_watched)) : 0;

  return (
    <Card className="h-full rounded-2xl">
      <CardContent className="p-6">
        <p className="text-sm font-semibold text-foreground">Video Engagement</p>
        {video ? (
          <div className="mt-4 flex items-center gap-6">
            <DonutStat percent={video.highest_percent_watched} />
            <div className="flex-1 space-y-3">
              <Stat icon={Clock} label="Total Watch Time" value={formatWatchTime(video.accumulated_seconds_watched)} />
              <Stat icon={Play} label="Play Count" value={String(video.play_count)} />
              <Stat icon={Clock} label="First Played" value={formatDateTime(video.first_played_at)} />
              <Stat icon={Clock} label="Last Played" value={formatDateTime(video.last_event_at)} />
              <div className="flex items-center gap-2">
                <Clock className="size-3.5 shrink-0 text-muted-foreground" />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] text-muted-foreground">Completion Status</p>
                    <p className="text-[11px] font-medium text-foreground">{Math.round(clampedPercent)}%</p>
                  </div>
                  <Progress value={clampedPercent} className="mt-1" />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">No video activity yet.</p>
        )}
      </CardContent>
    </Card>
  );
}
