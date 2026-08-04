import { Building2, FileText, Landmark, Sparkles, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { SectionHeader } from "@/components/dashboard/SectionHeader";
import { Badge } from "@/components/ui/badge";
import { OPPORTUNITY_SNAPSHOT, type SnapshotItem } from "@/lib/config/content";

const ICONS: Record<SnapshotItem["icon"], typeof FileText> = {
  timeline: Landmark,
  document: FileText,
  company: Building2,
  team: Users,
  highlights: Sparkles,
};

/**
 * Opportunity Snapshot tiles. Content modules ship in a later release, so
 * tiles render as previews rather than dead links.
 */
export function OpportunitySnapshot() {
  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <SectionHeader number={3} title="Opportunity Snapshot" />
          <Badge variant="outline">Available at consultation</Badge>
        </div>

        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {OPPORTUNITY_SNAPSHOT.map((item) => {
            const Icon = ICONS[item.icon];
            return (
              <li
                key={item.key}
                className="flex items-center gap-3 rounded-card border border-border bg-surface/60 p-3"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-control bg-card text-muted-foreground">
                  <Icon className="size-4" />
                </span>
                <span className="text-sm font-medium text-foreground">{item.title}</span>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
