import { Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { brand } from "@/lib/config/brand";

type StageStatus = "complete" | "current" | "available" | "upcoming";

interface Stage {
  label: string;
  description?: string;
  status: StageStatus;
}

const STATUS_BADGES: Partial<Record<StageStatus, { label: string; className: string }>> = {
  complete: { label: "Complete", className: "text-success" },
  current: { label: "Current step", className: "text-primary" },
  available: { label: "Available now", className: "text-primary" },
};

/**
 * "What Happens Next" — a simple, reassuring five-stage view of the process.
 * Stage states follow real portal data: booking completes stage two, and the
 * FDD acknowledgment (recorded by the backend) completes stage three.
 */
export function NextStepsTimeline({
  booked,
  fddAcknowledged,
}: {
  booked: boolean;
  fddAcknowledged: boolean;
}) {
  const stages: Stage[] = [
    { label: "Investor Profile Submitted", status: "complete" },
    {
      label: "Schedule Your Consultation",
      status: booked ? "complete" : "current",
    },
    {
      label: "Review the FDD",
      description: "Request your copy, acknowledge receipt, and begin your review.",
      status: fddAcknowledged ? "complete" : booked ? "current" : "available",
    },
    {
      label: "Speak With Your Advisor",
      description: "Discuss goals, questions, economics, and mutual fit.",
      status: booked && fddAcknowledged ? "current" : "upcoming",
    },
    {
      label: "Continue Due Diligence",
      description: "Review materials, validate the opportunity, and determine next steps.",
      status: "upcoming",
    },
  ];

  return (
    <Card>
      <CardContent className="p-6">
        <h2 className="text-[15.5px] font-bold text-foreground">What Happens Next</h2>
        <ol className="mt-5">
          {stages.map((stage, index) => {
            const badge = STATUS_BADGES[stage.status];
            const isLast = index === stages.length - 1;
            return (
              <li key={stage.label} className="relative flex gap-3.5 pb-0">
                <div className="flex flex-col items-center">
                  <span
                    className={cn(
                      "flex size-[26px] shrink-0 items-center justify-center rounded-full",
                      stage.status === "complete" &&
                        "border-[1.5px] border-success bg-card text-success",
                      stage.status === "current" && "border-[1.5px] border-primary bg-primary",
                      stage.status === "available" &&
                        "border-[1.5px] border-primary bg-card text-primary",
                      stage.status === "upcoming" &&
                        "border border-border-strong bg-card text-faint-foreground",
                    )}
                    aria-hidden
                  >
                    {stage.status === "complete" ? (
                      <Check className="size-3.5" strokeWidth={2.4} />
                    ) : stage.status === "current" ? (
                      <span className="size-2 rounded-full bg-white" />
                    ) : (
                      <span className="text-[11px] font-semibold">{index + 1}</span>
                    )}
                  </span>
                  {!isLast && <span aria-hidden className="w-px flex-1 bg-border-strong" />}
                </div>
                <div className={cn("min-w-0 flex-1", !isLast && "pb-5")}>
                  <p
                    className={cn(
                      "text-[13.5px] font-medium leading-[26px]",
                      stage.status === "upcoming" ? "text-muted-foreground" : "text-foreground",
                    )}
                  >
                    {stage.label}
                    {badge && (
                      <span className={cn("ml-2 text-xs font-medium", badge.className)}>
                        {badge.label}
                      </span>
                    )}
                  </p>
                  {stage.description && (
                    <p className="mt-0.5 text-[12.5px] leading-[1.6] text-muted-foreground">
                      {stage.description}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
        <p className="mt-4 border-t border-border-soft pt-3.5 text-[12.5px] leading-[1.6] text-muted-foreground">
          {brand.advisorName} reviews your investor profile before your conversation, so each step
          builds on the last.
        </p>
      </CardContent>
    </Card>
  );
}
