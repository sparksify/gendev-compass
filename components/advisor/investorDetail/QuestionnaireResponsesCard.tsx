import { Briefcase, CheckCircle2, Landmark, Target } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Disclosure } from "./Disclosure";
import { formatDateTime } from "@/lib/advisor/format";
import { labelForValue } from "@/lib/advisor/questionnaireCatalog";
import { cn } from "@/lib/utils";
import type { QuestionnaireRecord } from "@/types/questionnaire";
import type { QuestionnaireSubmissionWithAnswers } from "@/types/advisor";

function Group({
  chipClass,
  icon: Icon,
  name,
  fields,
  bordered = false,
}: {
  chipClass: string;
  icon: React.ComponentType<{ className?: string }>;
  name: string;
  fields: Array<[string, string | null]>;
  bordered?: boolean;
}) {
  return (
    <div className={cn(bordered && "lg:border-l lg:border-border-soft lg:pl-5")}>
      <p className="flex items-center gap-2">
        <span className={cn("flex size-[22px] shrink-0 items-center justify-center rounded-md", chipClass)}>
          <Icon className="size-3" />
        </span>
        <span className="text-[12.5px] font-semibold text-foreground">{name}</span>
      </p>
      <dl className="mt-2 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-x-3 gap-y-[5px]">
        {fields.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="text-xs font-medium text-foreground">{value ?? "—"}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/**
 * The submitted questionnaire, grouped into the three conversations it
 * feeds (investment, experience, goals). Full raw answers stay available
 * behind "View full responses" for the record.
 */
export function QuestionnaireResponsesCard({
  questionnaire,
  submission,
}: {
  questionnaire: QuestionnaireRecord | null;
  submission: QuestionnaireSubmissionWithAnswers;
}) {
  return (
    <Card id="questionnaire-responses" className="scroll-mt-4">
      <CardContent className="px-[15px] py-[13px]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.09em] text-muted-foreground">
              Questionnaire responses
            </p>
            <p className="flex items-center gap-1 text-[11.5px] text-[#15803d]">
              <CheckCircle2 className="size-3" />
              Submitted {formatDateTime(submission.submitted_at)} · Version {submission.questionnaire_version}
            </p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(270px,1fr))] gap-x-5 gap-y-3">
          <Group
            chipClass="bg-[#e8f6ec] text-[#15803d]"
            icon={Landmark}
            name="Investment"
            fields={[
              ["Investment timeline", questionnaire ? labelForValue(questionnaire.investment_timeline) : null],
              ["Liquid capital", questionnaire ? labelForValue(questionnaire.liquid_capital) : null],
              ["Estimated net worth", questionnaire ? labelForValue(questionnaire.net_worth) : null],
            ]}
          />
          <Group
            bordered
            chipClass="bg-primary-soft text-primary"
            icon={Briefcase}
            name="Experience"
            fields={[
              ["Owned a business before?", questionnaire ? labelForValue(questionnaire.business_ownership) : null],
              ["Decision criteria", questionnaire ? labelForValue(questionnaire.decision_criteria) : null],
              ["Who participates?", questionnaire ? labelForValue(questionnaire.decision_participants) : null],
            ]}
          />
          <Group
            bordered
            chipClass="bg-[#f3eeff] text-[#7c3aed]"
            icon={Target}
            name="Goals"
            fields={[
              ["Most interested in", questionnaire ? labelForValue(questionnaire.primary_interest) : null],
              ["Questions you want answered", questionnaire?.remaining_questions || null],
              ["Information accuracy", questionnaire ? (questionnaire.accuracy_confirmed ? "Confirmed" : "Not confirmed") : null],
            ]}
          />
        </div>

        <Disclosure summary="View full responses" className="mt-3">
          <dl className="space-y-2.5">
            {submission.answers.map((answer) => (
              <div key={answer.id}>
                <dt className="text-xs font-medium text-secondary-foreground">{answer.question_text}</dt>
                <dd className="mt-0.5 text-xs text-foreground">{answer.answer_display_value}</dd>
              </div>
            ))}
          </dl>
        </Disclosure>
      </CardContent>
    </Card>
  );
}
