import { Panel, PanelHeader, PanelMeta } from "@/components/advisor/v3";
import { cn } from "@/lib/utils";
import { formatRelative } from "@/lib/advisor/format";
import { SIGNAL } from "@/lib/advisor/discoveryStages";
import type { VideoProgressRecord } from "@/types/portal";

function clock(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/** Watched leads the row with a 2px green rule; the rest are plain hairlines. */
function Stat({ label, value, lead }: { label: string; value: string; lead?: boolean }) {
  const empty = value === "—";
  return (
    <div className={cn("pt-[7px]", lead ? "border-t-2 border-[#1b7a61]" : "border-t border-border-soft")}>
      <p className="text-[10.5px] font-bold uppercase tracking-[0.09em] text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "tabular mt-[3px] font-extrabold",
          empty ? "text-[15px] text-ghost-foreground" : "text-[18px]",
          !empty && lead && "text-[#1b7a61]",
        )}
      >
        {value}
      </p>
    </div>
  );
}

/**
 * The overview video as one bar: how far they got, where they stopped, how
 * many times they came back — closed by a plain-language read of what that
 * engagement means.
 *
 * The handoff's hatched "rewatched" band needs per-session progress events;
 * the store keeps a single high-water mark per lead, so that band degrades to
 * the plain watched fill and Rewatched reads "—" rather than inventing a
 * range. Everything else is real: percent, sessions (play_count), stop
 * position (last_playhead_position) and last activity.
 */
export function VideoEngagementCard({
  video,
  runtimeLabel,
}: {
  video: VideoProgressRecord | null;
  /** "25 min", when the overview's length is known. */
  runtimeLabel?: string | null;
}) {
  const percent = video ? Math.min(100, Math.max(0, Math.round(video.highest_percent_watched))) : 0;
  const stoppedAt = video?.last_playhead_position ?? 0;
  const sessions = video?.play_count ?? 0;

  const engagement =
    percent >= 60 ? "High video engagement" : percent >= 30 ? "Moderate video engagement" : "Low video engagement";

  return (
    <Panel>
      <PanelHeader
        title="Video Engagement"
        meta={
          <PanelMeta>Investor Overview{runtimeLabel ? ` · ${runtimeLabel}` : ""}</PanelMeta>
        }
      />

      {!video || percent === 0 ? (
        <p className="py-2 text-[13px] text-muted-foreground">
          No video activity yet — this client hasn&rsquo;t started the overview.
        </p>
      ) : (
        <>
          <div className="relative mt-[13px] h-[22px] overflow-hidden rounded-md bg-border-soft">
            <span
              className="absolute inset-y-0 left-0 bg-[#1b7a61]"
              style={{ width: `${percent}%` }}
            />
            {/* Where they stopped — the end of the watched fill. */}
            <span
              className="absolute inset-y-0 w-[2.5px] bg-foreground"
              style={{ left: `${percent}%` }}
            />
            {[25, 50, 75].map((tick) => (
              <span
                key={tick}
                aria-hidden
                className="absolute inset-y-0 w-px"
                style={{
                  left: `${tick}%`,
                  backgroundColor: percent >= tick ? "rgba(255,255,255,.55)" : "#d9dfda",
                }}
              />
            ))}
          </div>

          <div className="mt-1.5 flex justify-between text-[11.5px] font-semibold text-muted-foreground">
            <span>0:00</span>
            {[25, 50].map((tick) => (
              <span key={tick} style={{ color: percent >= tick ? SIGNAL.success : undefined }}>
                {tick}%{percent >= tick ? " ✓" : ""}
              </span>
            ))}
            {stoppedAt > 0 && (
              <span className="font-extrabold text-foreground">■ Stopped {clock(stoppedAt)}</span>
            )}
            <span style={{ color: percent >= 75 ? SIGNAL.success : undefined }}>
              75%{percent >= 75 ? " ✓" : ""}
            </span>
            <span>100%</span>
          </div>

          <div className="mt-[13px] grid grid-cols-2 gap-3.5 lg:grid-cols-4">
            <Stat label="Watched" value={`${percent}%`} lead />
            <Stat label="Sessions" value={sessions > 0 ? String(sessions) : "—"} />
            <Stat label="Rewatched" value="—" />
            <Stat
              label="Last watched"
              value={video.last_event_at ? formatRelative(video.last_event_at) : "—"}
            />
          </div>

          <p className="mt-[11px] text-[12.5px] leading-[1.55] text-secondary-foreground">
            <strong className="text-success">{engagement}</strong> —{" "}
            {video.completed ? "finished the overview" : `watched ${percent}%`}
            {sessions > 1 ? ` across ${sessions} sessions` : ""}
            {video.last_event_at ? ` and returned ${formatRelative(video.last_event_at)}` : ""}.
            {stoppedAt > 0 && ` Stopped at ${clock(stoppedAt)}.`}
          </p>
        </>
      )}
    </Panel>
  );
}
