import { Building2, FileText, Landmark, Sparkles, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { SectionHeader } from "@/components/dashboard/SectionHeader";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
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

        <ul className="grid gap-x-6 gap-y-4 pt-1 sm:grid-cols-2 xl:grid-cols-5">
          {OPPORTUNITY_SNAPSHOT.map((item, index) => {
            const Icon = ICONS[item.icon];
            return (
              <li
                key={item.key}
                className={cn(
                  "flex items-center gap-3 xl:border-l xl:border-border xl:pl-6",
                  index === 0 && "xl:border-l-0 xl:pl-0",
                )}
              >
                <Icon className="size-5 shrink-0 text-muted-foreground" strokeWidth={1.5} />
                <span className="text-[13px] font-medium leading-snug text-foreground">
                  {item.title}
                </span>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
