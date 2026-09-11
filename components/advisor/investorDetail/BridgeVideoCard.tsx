import { Panel, PanelHeader, PanelMeta } from "@/components/advisor/v3";
import { cn } from "@/lib/utils";
import { formatRelative } from "@/lib/advisor/format";
import { SIGNAL } from "@/lib/advisor/discoveryStages";
import type { BridgeVideoSummary } from "@/lib/bridge/videoSummary";

function clock(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

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
 * The bridge page's 3-minute video, read the same way as the overview
 * card beside it — how far they got and where they stopped — from the
 * lead's bridge_video_* events. Renders nothing until the video was
 * started, so clients who never saw the bridge page don't get an empty
 * panel.
 */
export function BridgeVideoCard({ summary }: { summary: BridgeVideoSummary }) {
  if (!summary.started) return null;

  const percent = summary.highestPercent;
  const stoppedAt = summary.stoppedAtSeconds;

  return (
    <Panel>
      <PanelHeader title="Bridge Video" meta={<PanelMeta>3-minute overview · before the portal</PanelMeta>} />

      <div className="relative mt-[13px] h-[22px] overflow-hidden rounded-md bg-border-soft">
        <span className="absolute inset-y-0 left-0 bg-[#1b7a61]" style={{ width: `${percent}%` }} />
        <span className="absolute inset-y-0 w-[2.5px] bg-foreground" style={{ left: `${percent}%` }} />
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
        {[25, 50, 75].map((tick) => (
          <span key={tick} style={{ color: percent >= tick ? SIGNAL.success : undefined }}>
            {tick}%{percent >= tick ? " ✓" : ""}
          </span>
        ))}
        <span>100%</span>
      </div>

      <div className="mt-[13px] grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <Stat label="Watched" value={`${percent}%`} lead />
        <Stat label="Finished" value={summary.completed ? "Yes" : "No"} />
        <Stat label="Stopped at" value={stoppedAt !== null ? clock(stoppedAt) : "—"} />
        <Stat
          label="Last watched"
          value={summary.lastEventAt ? formatRelative(summary.lastEventAt) : "—"}
        />
      </div>
    </Panel>
  );
}
