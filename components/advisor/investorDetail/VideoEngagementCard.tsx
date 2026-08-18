import { Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatDateTime, formatWatchTime } from "@/lib/advisor/format";
import type { VideoProgressRecord } from "@/types/portal";

function DonutStat({ percent }: { percent: number }) {
  const radius = 43;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(100, Math.max(0, percent));
  const offset = circumference * (1 - clamped / 100);

  return (
    <div className="relative flex size-[84px] shrink-0 items-center justify-center">
      <svg viewBox="0 0 100 100" className="size-full -rotate-90">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="#eef0f4" strokeWidth="9" />
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
        <span className="text-[17px] font-bold leading-none text-foreground">{Math.round(clamped)}%</span>
        <span className="mt-0.5 text-[10px] text-faint-foreground">watched</span>
      </div>
    </div>
  );
}

/**
 * Donut + supporting numbers side by side, with the completion bar
 * underneath — everything visible, nothing behind a disclosure.
 */
export function VideoEngagementCard({ video }: { video: VideoProgressRecord | null }) {
  const clamped = video ? Math.min(100, Math.max(0, video.highest_percent_watched)) : 0;

  return (
    <Card className="h-full">
      <CardContent className="px-[15px] py-[13px]">
        <p className="flex items-center gap-1 text-[15px] font-bold text-foreground">
          Video engagement
          <Info className="size-[13px] text-[#c2c9d4]" aria-label="Highest percent watched across sessions" />
        </p>
        {video ? (
          <>
            <div className="mt-[9px] flex items-center gap-3.5">
              <DonutStat percent={video.highest_percent_watched} />
              <div className="grid flex-1 grid-cols-[repeat(auto-fit,minmax(112px,1fr))] gap-x-3 gap-y-2">
                {[
                  ["Total watch time", formatWatchTime(video.accumulated_seconds_watched)],
                  ["Play count", String(video.play_count)],
                  ["First played", formatDateTime(video.first_played_at)],
                  ["Last played", formatDateTime(video.last_event_at)],
                ].map(([label, value]) => (
                  <div key={label} className="min-w-0">
                    <p className="text-[10.5px] text-faint-foreground">{label}</p>
                    <p className="text-[13px] font-semibold leading-snug text-foreground">{value}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-2.5 flex items-center gap-2">
              <Progress value={clamped} className="h-1.5 flex-1 bg-[#eef0f4]" />
              <span className="text-[11px] font-medium text-muted-foreground">{Math.round(clamped)}%</span>
            </div>
          </>
        ) : (
          <p className="mt-2.5 text-[13px] text-muted-foreground">No video activity yet.</p>
        )}
      </CardContent>
    </Card>
  );
}
