import { Fragment } from "react";
import { Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { JourneySummary } from "@/lib/portal/journey";

export function ProgressSummaryCard({ journey }: { journey: JourneySummary }) {
  return (
    <Card>
      <CardContent>
        <h2 className="text-[15.5px] font-bold text-foreground">Progress Summary</h2>

        <p className="mt-3.5 text-[12.5px] text-muted-foreground">Overall Completion</p>
        <p className="mt-1 text-[30px] font-bold leading-none text-primary">
          {journey.overallPercent}%
        </p>

        <ol aria-label="Milestone progress" className="mt-3.5 flex items-center">
          {journey.milestones.map((milestone, index) => {
            const done = milestone.status === "completed";
            const prevDone = index > 0 && journey.milestones[index - 1].status === "completed";
            return (
              <Fragment key={milestone.key}>
                {index > 0 && (
                  <li
                    aria-hidden
                    className={cn(
                      "h-0.5 flex-1",
                      prevDone && done ? "bg-primary" : "bg-[#e4e7ec]",
                    )}
                  />
                )}
                <li title={milestone.label} className="shrink-0">
                  <span
                    aria-hidden
                    className={cn(
                      "flex size-[15px] items-center justify-center rounded-full",
                      done
                        ? "bg-primary text-white"
                        : "border-[1.5px] border-border-strong bg-card",
                    )}
                  >
                    {done && <Check className="size-[9px]" strokeWidth={3.4} />}
                  </span>
                </li>
              </Fragment>
            );
          })}
        </ol>

        <p className="mt-[18px] text-[12.5px] text-muted-foreground">Current Status</p>
        <p className="mt-1 text-[13.5px] font-medium text-primary">{journey.currentStatusLabel}</p>
      </CardContent>
    </Card>
  );
}
