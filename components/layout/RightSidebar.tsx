import { AdvisorCard } from "@/components/cards/AdvisorCard";
import { FddCard } from "@/components/portal/FddCard";
import { InvestmentSnapshot } from "@/components/opportunity/InvestmentSnapshot";
import { getAdvisorPhotoUrl, resolveOpportunityProfile } from "@/lib/assets";
import { fddSnapshot } from "@/lib/fdd/status";
import { brand } from "@/lib/config/brand";
import type { LeadRecord } from "@/types/lead";
import type { PortalState } from "@/types/portal";

interface RightSidebarProps {
  token: string;
  state: PortalState;
  lead: LeadRecord;
}

/**
 * Right rail: the advisor, the FDD (once the investor profile is in), and
 * the deal terms. The consultation stays the primary action — the FDD card
 * sits below the advisor card as the next process step.
 */
export async function RightSidebar({ token, state, lead }: RightSidebarProps) {
  const [profile, advisorPhotoUrl] = await Promise.all([
    resolveOpportunityProfile(),
    getAdvisorPhotoUrl(),
  ]);

  return (
    <div className="space-y-4">
      <AdvisorCard token={token} state={state} photoUrl={advisorPhotoUrl ?? undefined} />
      {state.questionnaireCompleted && (
        <FddCard
          token={token}
          email={lead.email}
          initial={fddSnapshot(lead)}
          timeZone={brand.timeZone}
          advisorName={brand.advisorName}
        />
      )}
      <InvestmentSnapshot profile={profile} />
    </div>
  );
}
