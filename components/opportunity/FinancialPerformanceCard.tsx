import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { OpportunityProfile, PnlLine } from "@/lib/config/opportunity";

const ROW_STYLES: Record<PnlLine["variant"], { row: string; label: string; amount: string }> = {
  revenue: {
    row: "border-b border-border py-3",
    label: "text-[13.5px] font-semibold text-foreground",
    amount: "text-[13.5px] font-semibold text-foreground",
  },
  expense: {
    row: "border-b border-border-soft py-[9px] pl-4",
    label: "text-[13px] text-secondary-foreground",
    amount: "text-[13px] text-secondary-foreground",
  },
  subtotal: {
    row: "border-b border-border py-3",
    label: "text-[13px] font-medium text-foreground",
    amount: "text-[13px] font-medium text-foreground",
  },
  total: {
    row: "border-b border-border-soft py-3",
    label: "text-[13.5px] font-semibold text-foreground",
    amount: "text-[13.5px] font-semibold text-foreground",
  },
  deduction: {
    row: "border-b border-border-soft py-[9px] pl-4",
    label: "text-[13px] text-secondary-foreground",
    amount: "text-[13px] text-secondary-foreground",
  },
  result: {
    row: "-mx-3.5 mt-2 rounded-lg bg-primary-soft px-3.5 py-3",
    label: "text-[13.5px] font-bold text-foreground",
    amount: "text-[15px] font-bold text-primary",
  },
};

/** Financial Performance — the brand's P&L rendered as a clean statement. */
export function FinancialPerformanceCard({
  financial,
}: {
  financial: OpportunityProfile["financial"];
}) {
  return (
    <Card>
      <CardContent>
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="text-[15.5px] font-bold text-foreground">Financial Performance</h2>
          <p className="text-[12.5px] font-medium text-muted-foreground">
            {financial.statementLabel}
          </p>
        </div>

        <div className="mt-4 [font-variant-numeric:tabular-nums]">
          <div className="grid grid-cols-[minmax(0,1fr)_auto_52px] items-baseline gap-x-5 border-b border-border pb-2 text-[11px] font-medium uppercase tracking-[0.06em] text-faint-foreground">
            <span>Line Item</span>
            <span className="text-right">Amount</span>
            <span className="text-right">% Sales</span>
          </div>

          {financial.pnl.map((line) => {
            const styles = ROW_STYLES[line.variant];
            return (
              <div
                key={line.key}
                className={cn(
                  "grid grid-cols-[minmax(0,1fr)_auto_52px] items-baseline gap-x-5",
                  styles.row,
                )}
              >
                <span className={styles.label}>{line.label}</span>
                <span className={cn("text-right", styles.amount)}>{line.amount}</span>
                <span className="text-right text-[12px] text-muted-foreground">
                  {line.percentOfSales}
                </span>
              </div>
            );
          })}
        </div>

        <p className="mt-5 border-t border-border-soft pt-3.5 text-[11.5px] leading-[1.6] text-faint-foreground">
          {financial.disclaimer}
        </p>
      </CardContent>
    </Card>
  );
}
