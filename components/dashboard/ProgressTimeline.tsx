import { Fragment } from "react";
import {
  BarChart3,
  CalendarDays,
  Check,
  ClipboardList,
  FileText,
  MonitorPlay,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { JourneyMilestone } from "@/lib/portal/journey";

/** Per-milestone glyph shown while the step is still ahead (comp icons). */
const STEP_ICONS: Record<string, typeof FileText> = {
  application: ClipboardList,
  overview: MonitorPlay,
  questionnaire: FileText,
  consultation: CalendarDays,
  "operations-call": MonitorPlay,
  "qa-zoom": ShieldCheck,
  "investment-review": BarChart3,
};

/** One node in the journey timeline. */
function JourneyStep({ milestone }: { milestone: JourneyMilestone }) {
  const { status, key, label, note } = milestone;
  const Icon = STEP_ICONS[key] ?? FileText;

  return (
    <li className="flex flex-1 flex-col items-center gap-2.5">
      <span
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-full bg-card",
          status === "completed" && "border-[1.5px] border-success text-success",
          status === "active" && "border-[1.5px] border-sidebar bg-sidebar",
          (status === "locked" || status === "future") &&
            "border border-border-strong text-faint-foreground",
        )}
        aria-hidden
      >
        {status === "completed" ? (
          <Check className="size-[18px]" strokeWidth={2.2} />
        ) : status === "active" ? (
          <span className="size-3 rounded-full bg-white" />
        ) : (
          <Icon className="size-[17px]" strokeWidth={1.7} />
        )}
      </span>
      <span
        className={cn(
          "max-w-[8.5rem] text-center text-[13px] leading-[1.25]",
          status === "active"
            ? "font-semibold text-sidebar"
            : status === "completed"
              ? "text-secondary-foreground"
              : "text-muted-foreground",
        )}
      >
        {label}
        {note && <span className="block text-[10px] text-warning">{note}</span>}
      </span>
    </li>
  );
}

/** Horizontal seven-milestone journey tracker, integrated into StatusCard's
 * bottom section — every step visible on desktop, evenly distributed;
 * scrolls horizontally only when the viewport is too narrow to fit them. */
export function ProgressTimeline({ milestones }: { milestones: JourneyMilestone[] }) {
  return (
    <ol
      aria-label="Investment journey milestones"
      className="flex min-w-[620px] items-start lg:min-w-0"
    >
      {milestones.map((milestone, index) => (
        <Fragment key={milestone.key}>
          {index > 0 && (
            <li aria-hidden className="mt-[21px] h-px flex-1 shrink bg-border" />
          )}
          <JourneyStep milestone={milestone} />
        </Fragment>
      ))}
    </ol>
  );
}
