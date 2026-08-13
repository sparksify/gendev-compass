import { Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { labelForValue } from "@/lib/advisor/questionnaireCatalog";
import type { LeadRecord } from "@/types/lead";
import type { QuestionnaireRecord } from "@/types/questionnaire";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

export function QualificationOverviewCard({
  lead,
  questionnaire,
}: {
  lead: LeadRecord;
  questionnaire: QuestionnaireRecord | null;
}) {
  return (
    <Card className="h-full">
      <CardContent className="p-5">
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
            <Stat
              label="Qualification Score"
              value={
                lead.qualification_score !== null
                  ? `${lead.qualification_score} (${lead.qualification_result === "qualified" ? "qualified" : "review required"})`
                  : "—"
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
      </CardContent>
    </Card>
  );
}
