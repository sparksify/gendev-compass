import {
  BarChart3,
  CalendarDays,
  Check,
  ClipboardList,
  FileText,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { JourneyMilestone } from "@/lib/portal/journey";

/** Per-milestone glyph shown while the step is still ahead. */
const STEP_ICONS: Record<string, typeof FileText> = {
  application: ClipboardList,
  overview: FileText,
  questionnaire: FileText,
  consultation: CalendarDays,
  "due-diligence": ShieldCheck,
  "investment-review": BarChart3,
};

/** One node in the journey timeline. */
function JourneyStep({ milestone, isLast }: { milestone: JourneyMilestone; isLast: boolean }) {
  const { status, key, label, note } = milestone;
  const Icon = STEP_ICONS[key] ?? FileText;

  return (
    <li className="relative flex flex-1 flex-col items-center gap-2.5">
      {!isLast && (
        <span
          aria-hidden
          className={cn(
            "absolute left-[calc(50%+26px)] top-[17px] h-0.5 w-[calc(100%-52px)] rounded-full",
            status === "completed" ? "bg-primary/50" : "bg-border",
          )}
        />
      )}
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full transition-colors",
          status === "completed" && "bg-success text-white",
          status === "active" && "border-2 border-primary bg-card",
          (status === "locked" || status === "future") &&
            "border border-border bg-card text-muted-foreground/60",
        )}
        aria-hidden
      >
        {status === "completed" ? (
          <Check className="size-4" strokeWidth={3} />
        ) : status === "active" ? (
          <span className="size-3 rounded-full bg-primary" />
        ) : (
          <Icon className="size-4" strokeWidth={1.75} />
        )}
      </span>
      <span
        className={cn(
          "max-w-[7.5rem] text-center text-xs leading-snug",
          status === "active" ? "font-semibold text-primary" : "text-muted-foreground",
          status === "completed" && "text-foreground",
        )}
      >
        {label}
        {note && <span className="block text-[10px] text-warning">{note}</span>}
      </span>
    </li>
  );
}

/** Horizontal six-milestone journey tracker (spec: Journey Timeline). */
export function ProgressTimeline({ milestones }: { milestones: JourneyMilestone[] }) {
  return (
    <ol
      aria-label="Investment journey milestones"
      className="flex min-w-[640px] items-start"
    >
      {milestones.map((milestone, index) => (
        <JourneyStep
          key={milestone.key}
          milestone={milestone}
          isLast={index === milestones.length - 1}
        />
      ))}
    </ol>
  );
}
