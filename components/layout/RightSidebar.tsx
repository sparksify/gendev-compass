import { AdvisorCard } from "@/components/cards/AdvisorCard";
import { InvestmentSnapshot } from "@/components/opportunity/InvestmentSnapshot";
import { getAdvisorPhotoUrl, resolveOpportunityProfile } from "@/lib/assets";
import type { PortalState } from "@/types/portal";

interface RightSidebarProps {
  token: string;
  state: PortalState;
}

/** Right rail: the advisor and the deal terms. Nothing else. */
export async function RightSidebar({ token, state }: RightSidebarProps) {
  const [profile, advisorPhotoUrl] = await Promise.all([
    resolveOpportunityProfile(),
    getAdvisorPhotoUrl(),
  ]);

  return (
    <div className="space-y-[18px]">
      <AdvisorCard token={token} state={state} photoUrl={advisorPhotoUrl ?? undefined} />
      <InvestmentSnapshot profile={profile} />
    </div>
  );
}
