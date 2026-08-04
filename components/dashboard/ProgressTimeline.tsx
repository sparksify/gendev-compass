import { Check, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { JourneyMilestone } from "@/lib/portal/journey";

/** One node in the journey timeline. */
function JourneyStep({ milestone, isLast }: { milestone: JourneyMilestone; isLast: boolean }) {
  const { status, label, note } = milestone;

  return (
    <li className={cn("flex flex-1 flex-col items-center gap-2", isLast && "flex-none")}>
      <div className="flex w-full items-center">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
            status === "completed" && "border-success bg-success text-white",
            status === "active" && "border-primary bg-card text-primary",
            (status === "locked" || status === "future") &&
              "border-border bg-card text-muted-foreground/50",
          )}
          aria-hidden
        >
          {status === "completed" ? (
            <Check className="size-4" strokeWidth={3} />
          ) : status === "active" ? (
            <span className="size-2.5 rounded-full bg-primary" />
          ) : (
            <Lock className="size-3.5" />
          )}
        </span>
        {!isLast && (
          <span
            aria-hidden
            className={cn(
              "mx-2 h-0.5 flex-1 rounded-full",
              status === "completed" ? "bg-success/50" : "bg-border",
            )}
          />
        )}
      </div>
      <span
        className={cn(
          "-ml-0 w-24 text-center text-xs leading-snug sm:w-28",
          status === "active" ? "font-semibold text-foreground" : "text-muted-foreground",
          isLast ? "self-center" : "self-start -translate-x-[calc(50%-18px)]",
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
      className="flex items-start overflow-x-auto pb-1"
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
