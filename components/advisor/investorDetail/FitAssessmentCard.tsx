import { CheckCircle2, Compass } from "lucide-react";
import { Panel, PanelHeader, PanelMeta } from "@/components/advisor/v3";
import { formatDateTime } from "@/lib/advisor/format";
import { cn } from "@/lib/utils";
import type { BridgeAssessmentRecord } from "@/lib/bridge/assessmentRecord";

/**
 * The seven bridge-page answers, exactly as the prospect gave them, plus
 * the fit call that ordered their completion screen. Renders nothing for a
 * lead who never took the assessment.
 */
export function FitAssessmentCard({ assessment }: { assessment: BridgeAssessmentRecord | null }) {
  if (!assessment) return null;

  const strong = assessment.fit === "strong";
  const answers = assessment.answers.filter((a) => a.key !== "notes");
  const note = assessment.answers.find((a) => a.key === "notes")?.label ?? null;

  return (
    <Panel id="fit-assessment" className="scroll-mt-4">
      <PanelHeader
        title="Fit Assessment"
        meta={
          <PanelMeta>
            <span className="flex items-center gap-1 font-semibold text-success">
              <CheckCircle2 className="size-3" />
              Submitted {formatDateTime(assessment.submittedAt)} · bridge page
            </span>
          </PanelMeta>
        }
      />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-pill px-[11px] py-[3px] text-[11.5px] font-bold",
            strong ? "bg-success-soft text-success" : "bg-surface text-secondary-foreground",
          )}
        >
          <Compass className="size-3" />
          {strong ? "Strong fit" : "Standard fit"}
        </span>
        <span className="text-[12px] text-muted-foreground">
          {strong
            ? "Led with “Schedule a Conversation” on their next-step screen."
            : "Led with the Research Center on their next-step screen."}
        </span>
      </div>

      <dl className="mt-3.5 grid gap-x-5 gap-y-3 sm:grid-cols-2">
        {answers.map((answer) => (
          <div key={answer.key} className="min-w-0">
            <dt className="text-[11.5px] leading-[1.4] text-muted-foreground">{answer.question}</dt>
            <dd className="mt-0.5 text-[13px] font-semibold leading-[1.4] text-foreground">
              {answer.label}
            </dd>
          </div>
        ))}
      </dl>

      {note && (
        <div className="mt-3.5 rounded-[7px] border border-border-soft bg-surface px-3.5 py-2.5">
          <p className="text-[11.5px] text-muted-foreground">Anything else they wanted us to know</p>
          <p className="mt-0.5 whitespace-pre-line text-[13px] leading-[1.5] text-foreground">{note}</p>
        </div>
      )}
    </Panel>
  );
}
