import { AdvisorCard } from "@/components/cards/AdvisorCard";
import { ProgressSummaryCard } from "@/components/cards/ProgressSummaryCard";
import { DocumentCard } from "@/components/cards/DocumentCard";
import { ComingSoonCard } from "@/components/cards/ComingSoonCard";
import { Card, CardContent } from "@/components/ui/card";
import { COMING_SOON, RESOURCE_LIBRARY } from "@/lib/config/content";
import type { PortalState } from "@/types/portal";
import type { JourneySummary } from "@/lib/portal/journey";

interface RightSidebarProps {
  token: string;
  state: PortalState;
  journey: JourneySummary;
}

export function RightSidebar({ token, state, journey }: RightSidebarProps) {
  return (
    <div className="space-y-[18px]">
      <AdvisorCard token={token} scheduleUnlocked={state.qualified} booked={state.booked} />
      <ProgressSummaryCard journey={journey} />

      <Card id="resources">
        <CardContent>
          <h2 className="text-[15.5px] font-bold text-foreground">Resource Library</h2>
          <div className="mt-3.5 flex flex-col gap-[9px]">
            {RESOURCE_LIBRARY.map((item) => (
              <DocumentCard key={item.key} item={item} />
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <h2 className="text-[15.5px] font-bold text-foreground">Coming Soon</h2>
          <div className="mt-3.5 flex flex-col gap-[9px]">
            {COMING_SOON.map((item) => (
              <ComingSoonCard key={item.key} item={item} />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
