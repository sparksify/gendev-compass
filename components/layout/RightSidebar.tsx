import { AdvisorCard } from "@/components/cards/AdvisorCard";
import { InvestmentSnapshot } from "@/components/opportunity/InvestmentSnapshot";
import { getOpportunityProfile } from "@/lib/config/opportunity";
import type { PortalState } from "@/types/portal";

interface RightSidebarProps {
  token: string;
  state: PortalState;
}

/** Right rail: the advisor and the deal terms. Nothing else. */
export function RightSidebar({ token, state }: RightSidebarProps) {
  return (
    <div className="space-y-[18px]">
      <AdvisorCard token={token} scheduleUnlocked={state.qualified} booked={state.booked} />
      <InvestmentSnapshot snapshot={getOpportunityProfile().snapshot} />
    </div>
  );
}
