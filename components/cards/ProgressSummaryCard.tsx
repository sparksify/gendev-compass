import { Card, CardContent } from "@/components/ui/card";
import { ProgressRing } from "@/components/dashboard/ProgressRing";
import type { JourneySummary } from "@/lib/portal/journey";

export function ProgressSummaryCard({ journey }: { journey: JourneySummary }) {
  return (
    <Card>
      <CardContent className="space-y-4">
        <h2 className="text-sm font-semibold text-foreground">Progress Summary</h2>
        <div className="flex items-center gap-5">
          <ProgressRing value={journey.overallPercent} />
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Current milestone</dt>
              <dd className="font-medium text-foreground">{journey.currentMilestoneLabel}</dd>
            </div>
            {journey.nextMilestoneLabel && (
              <div>
                <dt className="text-xs text-muted-foreground">Up next</dt>
                <dd className="font-medium text-foreground">{journey.nextMilestoneLabel}</dd>
              </div>
            )}
          </dl>
        </div>
      </CardContent>
    </Card>
  );
}
