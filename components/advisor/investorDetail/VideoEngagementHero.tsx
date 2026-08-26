import { SectionRule } from "@/components/advisor/PageHeader";
import { cn } from "@/lib/utils";
import { formatRelative } from "@/lib/advisor/format";
import { SIGNAL } from "@/lib/advisor/discoveryStages";
import type { VideoProgressRecord } from "@/types/portal";

const GREEN = SIGNAL.success;

function clock(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/** Watched leads the row with a 2px green rule; the rest are plain hairlines. */
function Stat({
  label,
  value,
  lead,
}: {
  label: string;
  value: string;
  lead?: boolean;
}) {
  const empty = value === "—";
  return (
    <div
      className={cn("pt-2", lead ? "border-t-2" : "border-t border-border")}
      style={lead ? { borderTopColor: GREEN } : undefined}
    >
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "tabular mt-1 font-extrabold tracking-[-0.02em]",
          empty ? "text-[15px] text-ghost-foreground" : "text-[18.5px]",
        )}
        style={!empty && lead ? { color: GREEN } : undefined}
      >
        {value}
      </p>
    </div>
  );
}

/**
 * The client detail page's hero: the overview video as one bar — how far
 * they got, where they stopped, how many times they came back.
 *
 * The handoff's hatched "rewatched" band and its 8:40–11:20 range need
 * per-session progress events; the store keeps a single high-water mark per
 * lead, so that band degrades to the plain watched fill and Rewatched reads
 * "—" rather than inventing a range. Everything else is real: percent,
 * sessions (play_count), stop position (last_playhead_position) and last
 * activity.
 */
export function VideoEngagementHero({ video }: { video: VideoProgressRecord | null }) {
  const percent = video ? Math.min(100, Math.max(0, Math.round(video.highest_percent_watched))) : 0;
  const stoppedAt = video?.last_playhead_position ?? 0;
  const sessions = video?.play_count ?? 0;

  return (
    <div>
      <SectionRule label="Video engagement" meta="Investor overview" className="mb-3.5" />

      {!video || percent === 0 ? (
        <p className="py-2 text-[14px] text-muted-foreground">
          No video activity yet — this client hasn&rsquo;t started the overview.
        </p>
      ) : (
        <>
          <div className="relative h-[30px] overflow-hidden rounded-md bg-[#f6f6f7]">
            <span
              className="absolute inset-y-0 left-0"
              style={{ width: `${percent}%`, backgroundColor: GREEN }}
            />
            {/* Where they stopped — the end of the watched fill. */}
            <span className="absolute inset-y-0 w-0.5 bg-foreground" style={{ left: `${percent}%` }} />
            {[25, 50, 75].map((tick) => (
              <span
                key={tick}
                aria-hidden
                className="absolute inset-y-0 w-px"
                style={{
                  left: `${tick}%`,
                  backgroundColor: percent >= tick ? "#ffffff" : "#d7d9de",
                  opacity: percent >= tick ? 0.6 : 1,
                }}
              />
            ))}
          </div>

          <div className="mt-1.5 flex justify-between text-[11.5px] font-semibold text-muted-foreground">
            <span>0:00</span>
            <span style={{ color: percent >= 25 ? GREEN : undefined }}>
              25%{percent >= 25 ? " ✓" : ""}
            </span>
            <span style={{ color: percent >= 50 ? GREEN : undefined }}>
              50%{percent >= 50 ? " ✓" : ""}
            </span>
            {stoppedAt > 0 && (
              <span className="font-bold text-foreground">■ stopped {clock(stoppedAt)}</span>
            )}
            <span style={{ color: percent >= 75 ? GREEN : undefined }}>
              75%{percent >= 75 ? " ✓" : ""}
            </span>
            <span>100%</span>
          </div>

          <div className="mt-3.5 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label="Watched" value={`${percent}%`} lead />
            <Stat label="Sessions" value={sessions > 0 ? String(sessions) : "—"} />
            <Stat label="Rewatched" value="—" />
            <Stat
              label="Last watched"
              value={video.last_event_at ? formatRelative(video.last_event_at) : "—"}
            />
          </div>

          <p className="mt-2.5 text-[12.5px] leading-relaxed text-secondary-foreground">
            {video.completed
              ? "Finished the overview"
              : `Stopped at ${clock(stoppedAt)}, ${100 - percent}% short of the end`}
            {sessions > 1 ? ` across ${sessions} sessions.` : "."}{" "}
            <span className="text-muted-foreground">
              Per-segment replay isn&rsquo;t recorded yet, so no rewatched range is shown.
            </span>
          </p>
        </>
      )}
    </div>
  );
}
