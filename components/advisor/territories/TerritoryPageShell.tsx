import { PageBody, PageHeader } from "@/components/advisor/PageHeader";
import { TerritoryTabs } from "@/components/advisor/territories/TerritoryTabs";
import { countPendingTerritoryReviews } from "@/lib/advisor/territoryAdmin";

/**
 * Header + body for the Territory Advisor tabs that don't need client state
 * of their own (Map, Searches, Review Queue, Settings). Records and State
 * Eligibility render their own header so their action buttons can drive the
 * page.
 */
export async function TerritoryPageShell({
  subtitle,
  children,
}: {
  subtitle: string;
  children: React.ReactNode;
}) {
  const pendingReviews = await countPendingTerritoryReviews();

  return (
    <>
      <PageHeader
        title="Territory Advisor"
        subtitle={subtitle}
        tabs={<TerritoryTabs pendingReviews={pendingReviews} />}
      />
      <PageBody>{children}</PageBody>
    </>
  );
}
