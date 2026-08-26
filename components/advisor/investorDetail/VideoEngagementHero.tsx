import { SectionRule } from "@/components/advisor/PageHeader";
import { cn } from "@/lib/utils";
import { formatRelative } from "@/lib/advisor/format";
import { DISCOVERY_STAGES, SIGNAL } from "@/lib/advisor/discoveryStages";
import type { VideoProgressRecord } from "@/types/portal";

const TEAL = DISCOVERY_STAGES[0].color;
const BLUE = DISCOVERY_STAGES[1].color;
const VIOLET = DISCOVERY_STAGES[2].color;
const AMBER = DISCOVERY_STAGES[3].color;

function clock(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="border-t-2 pt-2.5" style={{ borderTopColor: color }}>
      <p className="text-[9.5px] font-bold uppercase tracking-[0.12em] text-faint-foreground">
        {label}
      </p>
      <p
        className={cn(
          "tabular mt-1 font-extrabold tracking-[-0.02em]",
          value === "—" ? "text-base text-ghost-foreground" : "text-xl",
        )}
        style={value === "—" ? undefined : { color }}
      >
        {value}
      </p>
    </div>
  );
}

/**
 * The client detail page's hero: the overview video as one 44px timeline —
 * how far they got, where they stopped, how many times they came back.
 *
 * The handoff's hatched "rewatched" band needs per-session progress events;
 * the store keeps a single high-water mark per lead, so that band degrades
 * to the watched fill and the Rewatched stat reads "—" rather than inventing
 * a range. Everything else here is real: percent, sessions (play_count),
 * stop position (last_playhead_position) and last activity.
 */
export function VideoEngagementHero({ video }: { video: VideoProgressRecord | null }) {
  const percent = video ? Math.min(100, Math.max(0, Math.round(video.highest_percent_watched))) : 0;
  const stoppedAt = video?.last_playhead_position ?? 0;
  const sessions = video?.play_count ?? 0;

  return (
    <div>
      <SectionRule label="Video engagement" meta="Investor overview" className="mb-3.5" />

      {!video || percent === 0 ? (
        <p className="py-2 text-[12.5px] text-muted-foreground">
          No video activity yet — this client hasn&rsquo;t started the overview.
        </p>
      ) : (
        <>
          <div className="relative h-11 overflow-hidden rounded-md bg-[#f6f6f7]">
            <span
              className="absolute inset-y-0 left-0"
              style={{
                width: `${percent}%`,
                background: `linear-gradient(90deg, ${TEAL}, ${BLUE} 55%, ${VIOLET})`,
              }}
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

          <div className="mt-[7px] flex justify-between text-[10px] font-semibold text-faint-foreground">
            <span>0:00</span>
            <span style={{ color: percent >= 25 ? TEAL : undefined }}>
              25%{percent >= 25 ? " ✓" : ""}
            </span>
            <span style={{ color: percent >= 50 ? BLUE : undefined }}>
              50%{percent >= 50 ? " ✓" : ""}
            </span>
            {stoppedAt > 0 && (
              <span className="font-bold text-foreground">■ stopped {clock(stoppedAt)}</span>
            )}
            <span style={{ color: percent >= 75 ? VIOLET : undefined }}>
              75%{percent >= 75 ? " ✓" : ""}
            </span>
            <span>100%</span>
          </div>

          <div className="mt-[18px] grid grid-cols-2 gap-5 lg:grid-cols-4">
            <Stat label="Watched" value={`${percent}%`} color={TEAL} />
            <Stat label="Sessions" value={sessions > 0 ? String(sessions) : "—"} color={BLUE} />
            <Stat label="Rewatched" value="—" color={VIOLET} />
            <Stat
              label="Last watched"
              value={video.last_event_at ? formatRelative(video.last_event_at) : "—"}
              color={AMBER}
            />
          </div>

          <p className="mt-3.5 text-[11.5px] leading-relaxed text-muted-foreground">
            {video.completed
              ? "Finished the overview"
              : `Stopped at ${clock(stoppedAt)}, ${100 - percent}% short of the end`}
            {sessions > 1 ? ` across ${sessions} sessions.` : "."}{" "}
            <span style={{ color: SIGNAL.neutral }}>
              Per-segment replay isn&rsquo;t recorded yet, so no rewatched range is shown.
            </span>
          </p>
        </>
      )}
    </div>
  );
}
