import { Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { JourneySummary } from "@/lib/portal/journey";

export function ProgressSummaryCard({ journey }: { journey: JourneySummary }) {
  return (
    <Card>
      <CardContent className="space-y-4">
        <h2 className="text-base font-semibold text-foreground">Progress Summary</h2>

        <div>
          <p className="text-[13px] text-muted-foreground">Overall Completion</p>
          <p className="mt-1 font-serif text-[2.5rem] font-semibold leading-none tracking-tight text-primary">
            {journey.overallPercent}%
          </p>
        </div>

        <ol
          aria-label="Milestone progress"
          className="flex items-center"
        >
          {journey.milestones.map((milestone, index) => (
            <li
              key={milestone.key}
              className={cn("flex items-center", index > 0 && "flex-1")}
              title={milestone.label}
            >
              {index > 0 && (
                <span
                  aria-hidden
                  className={cn(
                    "h-px flex-1",
                    milestone.status === "completed" ? "bg-primary/50" : "bg-border",
                  )}
                />
              )}
              <span
                aria-hidden
                className={cn(
                  "flex size-[18px] shrink-0 items-center justify-center rounded-full",
                  milestone.status === "completed" && "bg-primary text-white",
                  milestone.status === "active" && "border-2 border-primary bg-card",
                  (milestone.status === "locked" || milestone.status === "future") &&
                    "border border-border bg-card",
                )}
              >
                {milestone.status === "completed" && (
                  <Check className="size-2.5" strokeWidth={3.5} />
                )}
                {milestone.status === "active" && (
                  <span className="size-1.5 rounded-full bg-primary" />
                )}
              </span>
            </li>
          ))}
        </ol>

        <div className="border-t border-border pt-3.5">
          <p className="text-[13px] text-muted-foreground">Current Status</p>
          <p className="mt-0.5 text-sm font-medium text-primary">
            {journey.currentMilestoneLabel}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
