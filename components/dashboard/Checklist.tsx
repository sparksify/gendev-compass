import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/dashboard/SectionHeader";
import { CheckCircleSolid } from "@/components/dashboard/CheckCircleSolid";
import type { PortalState } from "@/types/portal";

interface ChecklistEntry {
  key: string;
  title: string;
  subtitle: string;
  completed: boolean;
}

/** Qualification checklist card (comp: Checklist). */
export function Checklist({ state }: { state: PortalState }) {
  const entries: ChecklistEntry[] = [
    {
      key: "video",
      title: "Investor Overview",
      subtitle: state.videoCompleted
        ? "Completed"
        : state.videoStarted
          ? `In progress — ${state.videoPercent}% watched`
          : "Not started",
      completed: state.videoCompleted,
    },
    {
      key: "questionnaire",
      title: "Candidate Questionnaire",
      subtitle: state.questionnaireCompleted ? "Completed" : "Estimated 15–20 Minutes",
      completed: state.questionnaireCompleted,
    },
    {
      key: "consultation",
      title: "Schedule Consultation",
      subtitle: state.booked ? "Scheduled" : "Takes 2 Minutes",
      completed: state.booked,
    },
    {
      key: "due-diligence",
      title: "Due Diligence Access",
      subtitle: "Unlocks after consultation",
      completed: false,
    },
  ];

  return (
    <Card>
      <div className="px-5 pb-3 pt-[18px]">
        <SectionHeader number={2} title="Qualification Checklist" />
      </div>

      <ul>
        {entries.map((entry) => (
          <li
            key={entry.key}
            className="flex items-center gap-3 border-t border-border-soft px-5 py-3.5 last:pb-[18px]"
          >
            {entry.completed ? (
              <CheckCircleSolid className="size-[19px] shrink-0" />
            ) : (
              <span
                aria-hidden
                className="size-[17px] shrink-0 rounded-full border-[1.5px] border-border-strong"
              />
            )}
            <div>
              <p className="text-[13.5px] font-medium text-foreground">{entry.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{entry.subtitle}</p>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
