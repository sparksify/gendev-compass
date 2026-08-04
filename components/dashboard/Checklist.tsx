import Link from "next/link";
import { Check, Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/dashboard/SectionHeader";
import { cn } from "@/lib/utils";
import type { PortalState } from "@/types/portal";

interface ChecklistProps {
  token: string;
  state: PortalState;
}

interface ChecklistEntry {
  key: string;
  title: string;
  subtitle: string;
  status: "completed" | "active" | "locked";
}

/** Qualification checklist card (spec: Checklist). */
export function Checklist({ token, state }: ChecklistProps) {
  const entries: ChecklistEntry[] = [
    {
      key: "video",
      title: "Investor Overview",
      subtitle: state.videoCompleted
        ? "Completed"
        : state.videoStarted
          ? `In progress — ${state.videoPercent}% watched`
          : "Not started",
      status: state.videoCompleted ? "completed" : "active",
    },
    {
      key: "questionnaire",
      title: "Candidate Questionnaire",
      subtitle: state.questionnaireCompleted ? "Completed" : "Estimated 15–20 minutes",
      status: state.questionnaireCompleted
        ? "completed"
        : state.videoCompleted
          ? "active"
          : "locked",
    },
    {
      key: "consultation",
      title: "Schedule Consultation",
      subtitle: state.booked ? "Scheduled" : "Takes 2 minutes",
      status: state.booked ? "completed" : state.qualified ? "active" : "locked",
    },
    {
      key: "due-diligence",
      title: "Due Diligence Access",
      subtitle: "Unlocks after consultation",
      status: "locked",
    },
  ];

  const nextAction = !state.videoCompleted
    ? null
    : !state.questionnaireCompleted
      ? { href: `/p/${token}/questionnaire`, label: "Start Questionnaire" }
      : state.qualified && !state.booked
        ? { href: `/p/${token}/schedule`, label: "Schedule Consultation" }
        : null;

  return (
    <Card>
      <CardContent className="space-y-4">
        <SectionHeader number={2} title="Qualification Checklist" />

        <ul className="divide-y divide-border">
          {entries.map((entry) => (
            <li key={entry.key} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              <span
                aria-hidden
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full border-2",
                  entry.status === "completed" && "border-success bg-success text-white",
                  entry.status === "active" && "border-primary text-primary",
                  entry.status === "locked" && "border-border text-muted-foreground/50",
                )}
              >
                {entry.status === "completed" ? (
                  <Check className="size-3.5" strokeWidth={3} />
                ) : entry.status === "locked" ? (
                  <Lock className="size-3" />
                ) : null}
              </span>
              <div>
                <p
                  className={cn(
                    "text-sm font-medium",
                    entry.status === "locked" ? "text-muted-foreground" : "text-foreground",
                  )}
                >
                  {entry.title}
                </p>
                <p className="text-xs text-muted-foreground">{entry.subtitle}</p>
              </div>
            </li>
          ))}
        </ul>

        {nextAction && (
          <Button asChild className="w-full">
            <Link href={nextAction.href}>{nextAction.label}</Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
