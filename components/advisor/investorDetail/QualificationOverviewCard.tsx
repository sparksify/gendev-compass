import { Briefcase, CalendarClock, Info, Landmark, Wallet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { labelForValue } from "@/lib/advisor/questionnaireCatalog";
import { cn } from "@/lib/utils";
import type { LeadRecord } from "@/types/lead";
import type { QuestionnaireRecord } from "@/types/questionnaire";

function Fact({
  chipClass,
  icon: Icon,
  label,
  value,
}: {
  chipClass: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | null;
}) {
  return (
    <div className="flex items-center gap-[11px]">
      <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-md", chipClass)}>
        <Icon className="size-[13px]" />
      </span>
      <span className="flex-1 text-[12.5px] text-secondary-foreground">{label}</span>
      <span className="whitespace-nowrap text-[12.5px] font-semibold text-foreground">
        {value ?? "—"}
      </span>
    </div>
  );
}

/**
 * Static facts, laid out as one horizontal strip near the questionnaire
 * they came from — deliberately below the actionable cards.
 */
export function QualificationOverviewCard({
  lead,
  questionnaire,
}: {
  lead: LeadRecord;
  questionnaire: QuestionnaireRecord | null;
}) {
  const liquidCapital = questionnaire?.liquid_capital ?? lead.initial_liquid_capital;
  const netWorth = questionnaire?.net_worth ?? lead.initial_net_worth;
  const ownership = questionnaire?.business_ownership
    ? labelForValue(questionnaire.business_ownership)
    : lead.initial_business_owner === null
      ? null
      : lead.initial_business_owner
        ? "Yes"
        : "No";

  return (
    <Card>
      <CardContent className="px-[15px] py-[13px]">
        <p className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-[0.09em] text-muted-foreground">
          Qualification
          <Info className="size-[13px] text-[#c2c9d4]" aria-label="Financials are self-reported by the prospect" />
        </p>
        <div className="mt-2 grid grid-cols-[repeat(auto-fit,minmax(230px,1fr))] gap-x-[26px] gap-y-2">
          <Fact
            chipClass="bg-[#e8f6ec] text-[#15803d]"
            icon={Landmark}
            label="Liquid capital"
            value={liquidCapital ? labelForValue(liquidCapital) : null}
          />
          <Fact
            chipClass="bg-primary-soft text-primary"
            icon={Wallet}
            label="Net worth"
            value={netWorth ? labelForValue(netWorth) : null}
          />
          <Fact
            chipClass="bg-[#f3eeff] text-[#7c3aed]"
            icon={CalendarClock}
            label="Timeline"
            value={questionnaire?.investment_timeline ? labelForValue(questionnaire.investment_timeline) : null}
          />
          <Fact
            chipClass="bg-[#fdf3d7] text-[#b4820f]"
            icon={Briefcase}
            label="Business ownership"
            value={ownership}
          />
        </div>
      </CardContent>
    </Card>
  );
}
