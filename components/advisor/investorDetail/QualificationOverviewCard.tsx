import { Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { labelForValue, labelIn } from "@/lib/advisor/questionnaireCatalog";
import { CREDIT_SCORE_RANGES } from "@/types/questionnaire";
import type { LeadRecord } from "@/types/lead";
import type { QuestionnaireRecord } from "@/types/questionnaire";

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <div className="mt-0.5 text-sm font-medium text-foreground">{value}</div>
    </div>
  );
}

/** Compact spec-style "Yes / Maybe / No" — the questionnaire's own labels
 * ("Possibly — I may use some financing…") are too long for this summary. */
const FUNDING_NEEDED_SHORT: Record<string, string> = {
  no: "No",
  possibly: "Maybe",
  yes: "Yes",
  "not-sure": "Not sure",
};

export function QualificationOverviewCard({
  lead,
  questionnaire,
  hasFullProfile,
}: {
  lead: LeadRecord;
  questionnaire: QuestionnaireRecord | null;
  /** Whether a full submitted-questionnaire card exists lower on the page
   * to link out to. */
  hasFullProfile: boolean;
}) {
  return (
    <Card className="h-full rounded-2xl">
      <CardContent className="p-6">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-semibold text-foreground">Qualification Overview</p>
          <Info
            className="size-3.5 text-muted-foreground"
            aria-label="Financials are self-reported by the prospect"
          />
        </div>

        {questionnaire ? (
          <div className="mt-3 space-y-3">
            <Stat label="Liquid Capital" value={labelForValue(questionnaire.liquid_capital)} />
            <Stat label="Net Worth" value={labelForValue(questionnaire.net_worth)} />
            <Stat label="Investment Timeline" value={labelForValue(questionnaire.investment_timeline)} />
            {questionnaire.estimated_credit_score_range && (
              <Stat
                label="Credit Score"
                value={labelIn(CREDIT_SCORE_RANGES, questionnaire.estimated_credit_score_range)}
              />
            )}
            {questionnaire.financing_need && (
              <Stat
                label="Funding Needed"
                value={FUNDING_NEEDED_SHORT[questionnaire.financing_need] ?? questionnaire.financing_need}
              />
            )}
            <Stat
              label="Qualification"
              value={
                lead.qualification_result === "qualified" ? (
                  <Badge variant="success">Qualified</Badge>
                ) : lead.qualification_result === "review_required" ? (
                  <Badge variant="outline">Review Required</Badge>
                ) : (
                  <span className="text-muted-foreground">Not yet assessed</span>
                )
              }
            />
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            <Stat label="Liquid Capital (from lead form)" value={labelForValue(lead.initial_liquid_capital)} />
            <Stat label="Net Worth (from lead form)" value={labelForValue(lead.initial_net_worth)} />
            <p className="pt-1 text-sm text-muted-foreground">Questionnaire not completed yet.</p>
          </div>
        )}

        {hasFullProfile && (
          <a
            href="#questionnaire-responses"
            className="mt-4 inline-block text-xs font-medium text-primary hover:underline"
          >
            View Full Qualification Profile →
          </a>
        )}
      </CardContent>
    </Card>
  );
}
