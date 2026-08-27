import { PageTitle, V3Page } from "@/components/advisor/v3";
import { TerritoryTabs } from "@/components/advisor/territories/TerritoryTabs";
import { countPendingTerritoryReviews } from "@/lib/advisor/territoryAdmin";

/**
 * Title + tab row + body for the Territory Advisor tabs that don't need
 * client state of their own (Map, Searches, Review Queue, Settings). Records
 * and State Eligibility render their own header so their action buttons can
 * drive the page.
 */
export async function TerritoryPageShell({
  subtitle,
  actions,
  children,
}: {
  subtitle: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pendingReviews = await countPendingTerritoryReviews();

  return (
    <V3Page>
      <PageTitle title="Territory Advisor" meta={subtitle} actions={actions} />
      <TerritoryTabs pendingReviews={pendingReviews} />
      {children}
    </V3Page>
  );
}
