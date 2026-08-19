import { Briefcase, CheckCircle2, Download, Landmark, MapPin, Target, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Disclosure } from "./Disclosure";
import { formatDateTime } from "@/lib/advisor/format";
import { labelForValue, labelIn } from "@/lib/advisor/questionnaireCatalog";
import { cn } from "@/lib/utils";
import type { QuestionnaireRecord } from "@/types/questionnaire";
import {
  CASH_CONTRIBUTION_RANGES,
  CREDIT_SCORE_RANGES,
  EXISTING_ENTITY_OPTIONS,
  FINANCING_NEED_OPTIONS,
  FINANCING_PERCENTAGE_OPTIONS,
  FUNDING_ASSISTANCE_OPTIONS,
  FUNDING_SOURCE_OPTIONS,
  LENDER_STATUS_OPTIONS,
  PRIOR_FINANCING_EXPERIENCE_OPTIONS,
} from "@/types/questionnaire";
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
            <p className="text-[15px] font-bold text-foreground">
              Questionnaire responses
            </p>
            <p className="flex items-center gap-1 text-[11.5px] text-[#15803d]">
              <CheckCircle2 className="size-3" />
              Submitted {formatDateTime(submission.submitted_at)} · Version {submission.questionnaire_version}
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <a href={`/api/advisor/investors/${submission.lead_id}/questionnaire-pdf`} download>
              <Download className="size-3.5" />
              Download PDF
            </a>
          </Button>
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
          <Group
            bordered
            chipClass="bg-[#fff4e5] text-[#b45309]"
            icon={MapPin}
            name="Location"
            fields={[
              [
                "Street address",
                questionnaire
                  ? [questionnaire.address_line_1, questionnaire.address_line_2]
                      .filter(Boolean)
                      .join(", ") || null
                  : null,
              ],
              ["City", questionnaire?.city || null],
              ["State", questionnaire?.state || null],
              ["ZIP / postal code", questionnaire?.postal_code || null],
              ["Country", questionnaire?.country || null],
            ]}
          />
          <Group
            bordered
            chipClass="bg-[#e7f1fe] text-[#1d4ed8]"
            icon={Wallet}
            name="Credit & Funding"
            fields={[
              [
                "Credit score (self-reported)",
                questionnaire
                  ? labelIn(CREDIT_SCORE_RANGES, questionnaire.estimated_credit_score_range)
                  : null,
              ],
              [
                "Funding sources",
                questionnaire &&
                Array.isArray(questionnaire.anticipated_funding_sources) &&
                questionnaire.anticipated_funding_sources.length > 0
                  ? questionnaire.anticipated_funding_sources
                      .map((source) => labelIn(FUNDING_SOURCE_OPTIONS, source))
                      .join(", ")
                  : null,
              ],
              [
                "Financing need",
                questionnaire ? labelIn(FINANCING_NEED_OPTIONS, questionnaire.financing_need) : null,
              ],
              [
                "Prefers to finance",
                questionnaire
                  ? questionnaire.financing_need === "no"
                    ? "N/A"
                    : labelIn(FINANCING_PERCENTAGE_OPTIONS, questionnaire.preferred_financing_percentage)
                  : null,
              ],
              [
                "Lender status",
                questionnaire
                  ? questionnaire.financing_need === "no"
                    ? "N/A"
                    : labelIn(LENDER_STATUS_OPTIONS, questionnaire.lender_status)
                  : null,
              ],
              [
                "Wants financing help",
                questionnaire
                  ? questionnaire.financing_need === "no"
                    ? "N/A"
                    : labelIn(FUNDING_ASSISTANCE_OPTIONS, questionnaire.funding_assistance_requested)
                  : null,
              ],
              [
                "Cash contribution",
                questionnaire
                  ? labelIn(CASH_CONTRIBUTION_RANGES, questionnaire.available_cash_contribution)
                  : null,
              ],
              [
                "Existing business entity",
                questionnaire
                  ? labelIn(EXISTING_ENTITY_OPTIONS, questionnaire.existing_business_entity)
                  : null,
              ],
              [
                "Prior SBA/commercial financing",
                questionnaire
                  ? labelIn(
                      PRIOR_FINANCING_EXPERIENCE_OPTIONS,
                      questionnaire.prior_business_financing_experience,
                    )
                  : null,
              ],
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
