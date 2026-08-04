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
          "flex size-[34px] shrink-0 items-center justify-center rounded-full bg-card",
          status === "completed" && "border-[1.5px] border-success text-success",
          status === "active" && "border-[1.5px] border-primary bg-primary",
          (status === "locked" || status === "future") &&
            "border border-border-strong text-faint-foreground",
        )}
        aria-hidden
      >
        {status === "completed" ? (
          <Check className="size-4" strokeWidth={2.2} />
        ) : status === "active" ? (
          <span className="size-[11px] rounded-full bg-white" />
        ) : (
          <Icon className="size-[15px]" strokeWidth={1.7} />
        )}
      </span>
      <span
        className={cn(
          "max-w-[7.5rem] text-center text-[11.5px] leading-[1.35]",
          status === "active"
            ? "font-medium text-primary"
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

/** Horizontal seven-milestone journey tracker (comp: Journey Timeline). */
export function ProgressTimeline({ milestones }: { milestones: JourneyMilestone[] }) {
  return (
    <ol
      aria-label="Investment journey milestones"
      className="flex min-w-[700px] items-start"
    >
      {milestones.map((milestone, index) => (
        <Fragment key={milestone.key}>
          {index > 0 && (
            <li aria-hidden className="mt-[17px] h-px w-[26px] shrink-0 bg-border-strong" />
          )}
          <JourneyStep milestone={milestone} />
        </Fragment>
      ))}
    </ol>
  );
}
