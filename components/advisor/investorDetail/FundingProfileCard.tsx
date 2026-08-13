import { Landmark } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CompactCardIcon } from "./CompactCardIcon";
import { Disclosure } from "./Disclosure";
import { labelForValue, labelIn } from "@/lib/advisor/questionnaireCatalog";
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
import type { QuestionnaireRecord } from "@/types/questionnaire";

function DetailField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm text-foreground">{value ?? "—"}</p>
    </div>
  );
}

/** Collapsed by default — a one-line summary plus a chevron into the full
 * financing breakdown, never the whole thing shown up front. */
export function FundingProfileCard({ questionnaire }: { questionnaire: QuestionnaireRecord | null }) {
  const summary = !questionnaire
    ? "Questionnaire not completed"
    : questionnaire.funding_followup_requested
      ? "Funding assistance requested"
      : labelIn(FINANCING_NEED_OPTIONS, questionnaire.financing_need);

  return (
    <Card className="rounded-2xl">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <CompactCardIcon icon={Landmark} />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">Funding Profile</p>
              <p className="mt-1 text-xs text-muted-foreground">{summary}</p>
            </div>
          </div>
          {questionnaire?.funding_followup_requested && (
            <Badge className="shrink-0 bg-primary-soft text-primary">Assistance Requested</Badge>
          )}
        </div>

        {questionnaire && (
          <Disclosure summary="Full breakdown" className="mt-2 pl-12">
            <div className="grid gap-3 sm:grid-cols-2">
              <DetailField
                label="Estimated credit range (self-reported)"
                value={labelIn(CREDIT_SCORE_RANGES, questionnaire.estimated_credit_score_range)}
              />
              <DetailField label="Liquid capital" value={labelForValue(questionnaire.liquid_capital)} />
              <DetailField
                label="Available cash contribution"
                value={labelIn(CASH_CONTRIBUTION_RANGES, questionnaire.available_cash_contribution)}
              />
              <DetailField
                label="Preferred financing percentage"
                value={
                  questionnaire.financing_need === "no"
                    ? "N/A — no financing expected"
                    : labelIn(FINANCING_PERCENTAGE_OPTIONS, questionnaire.preferred_financing_percentage)
                }
              />
              <DetailField
                label="Lender status"
                value={
                  questionnaire.financing_need === "no"
                    ? "N/A — no financing expected"
                    : labelIn(LENDER_STATUS_OPTIONS, questionnaire.lender_status)
                }
              />
              <DetailField
                label="Funding assistance requested"
                value={
                  questionnaire.financing_need === "no"
                    ? "N/A — no financing expected"
                    : labelIn(FUNDING_ASSISTANCE_OPTIONS, questionnaire.funding_assistance_requested)
                }
              />
              <DetailField
                label="Existing business entity"
                value={labelIn(EXISTING_ENTITY_OPTIONS, questionnaire.existing_business_entity)}
              />
              <DetailField
                label="Prior SBA / commercial financing"
                value={labelIn(PRIOR_FINANCING_EXPERIENCE_OPTIONS, questionnaire.prior_business_financing_experience)}
              />
              <div className="sm:col-span-2">
                <DetailField
                  label="Expected funding sources"
                  value={
                    questionnaire.anticipated_funding_sources?.length
                      ? questionnaire.anticipated_funding_sources
                          .map((source) => labelIn(FUNDING_SOURCE_OPTIONS, source))
                          .join(" · ")
                      : "Not provided"
                  }
                />
              </div>
            </div>
          </Disclosure>
        )}
      </CardContent>
    </Card>
  );
}
