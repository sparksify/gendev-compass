import { Flame } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

/**
 * A subtle, premium callout — not a banner — surfaced only when the lead's
 * real last-activity timestamp (the same field the header's "Last Activity"
 * field reads) falls inside the last 24 hours. No separate "hotness" score
 * is invented; this is a thin presentation over existing follow-up-relevant
 * data, sitting directly above the Activity Timeline it explains.
 */
export function HotLeadSignalCard({ active }: { active: boolean }) {
  if (!active) return null;

  return (
    <Card className="rounded-2xl border-success/20 bg-success-soft">
      <CardContent className="flex items-center gap-3 px-5 py-3.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
          <Flame className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">Hot Lead Signal</p>
          <p className="text-xs text-muted-foreground">Recent activity within the last 24 hours.</p>
        </div>
      </CardContent>
    </Card>
  );
}
