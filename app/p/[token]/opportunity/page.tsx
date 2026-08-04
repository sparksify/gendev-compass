import { OpportunityHeader } from "@/components/opportunity/OpportunityHeader";
import { BrandOverviewCard } from "@/components/opportunity/BrandOverviewCard";
import { FeatureGrid } from "@/components/opportunity/FeatureCard";
import { CustomerGrid } from "@/components/opportunity/CustomerGrid";
import { FinancialPerformanceCard } from "@/components/opportunity/FinancialPerformanceCard";
import { DocumentLibrary } from "@/components/opportunity/DocumentLibrary";
import { InvalidPortal } from "@/components/portal/InvalidPortal";
import { loadPortalContext } from "@/lib/portal/context";
import { getOpportunityProfile } from "@/lib/config/opportunity";
import { trackEvent } from "@/lib/portal/events";

export const dynamic = "force-dynamic";

/**
 * Opportunity Overview: the investment profile for the featured brand.
 * Informational at every stage — the qualification flow (video,
 * questionnaire, scheduling) is gated elsewhere and unaffected.
 */
export default async function OpportunityPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const context = await loadPortalContext(token);
  if (!context) return <InvalidPortal />;

  const profile = getOpportunityProfile();
  await trackEvent(context.lead, "opportunity_overview_opened", { brand: profile.slug }, "opportunity");

  return (
    <div className="space-y-[18px]">
      <OpportunityHeader profile={profile} />
      <BrandOverviewCard paragraphs={profile.overview} />
      <FeatureGrid features={profile.features} />
      <CustomerGrid customers={profile.customers} />
      <FinancialPerformanceCard financial={profile.financial} />
      <DocumentLibrary documents={profile.documents} />
    </div>
  );
}
