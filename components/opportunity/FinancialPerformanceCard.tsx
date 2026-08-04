import { Card, CardContent } from "@/components/ui/card";
import type { OpportunityProfile } from "@/lib/config/opportunity";

/** Financial Performance — one large reported figure, quietly presented. */
export function FinancialPerformanceCard({
  financial,
}: {
  financial: OpportunityProfile["financial"];
}) {
  return (
    <Card>
      <CardContent>
        <h2 className="text-[15.5px] font-bold text-foreground">Financial Performance</h2>

        <p className="mt-5 text-4xl font-bold tracking-tight text-foreground [font-variant-numeric:tabular-nums]">
          {financial.headlineValue}
        </p>
        <p className="mt-1.5 text-[12.5px] text-muted-foreground">{financial.headlineLabel}</p>

        <p className="mt-5 border-t border-border-soft pt-3.5 text-[11.5px] leading-[1.6] text-faint-foreground">
          {financial.disclaimer}
        </p>
      </CardContent>
    </Card>
  );
}
