import type { Metadata } from "next";
import { PageTitle, V3Page } from "@/components/advisor/v3";
import { AnalyticsCommandCenter } from "@/components/analytics/AnalyticsCommandCenter";
import {
  loadAnalyticsReport,
  parseAnalyticsFilters,
  type AnalyticsTab,
} from "@/lib/analytics/report";
import { requireStaffUser } from "@/lib/advisor/auth";

export const metadata: Metadata = { title: "Analytics — Gen Dev Compass" };
export const dynamic = "force-dynamic";

const TABS = new Set<AnalyticsTab>([
  "overview", "funnel", "advertising", "pages", "appointments", "leads", "diagnostics",
]);

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [user, params] = await Promise.all([requireStaffUser(), searchParams]);
  const filters = parseAnalyticsFilters(params);
  const requested = typeof params.tab === "string" ? params.tab : "overview";
  const tab = TABS.has(requested as AnalyticsTab) ? requested as AnalyticsTab : "overview";
  const report = await loadAnalyticsReport(user, filters);

  return (
    <V3Page className="max-w-[1700px]">
      <PageTitle
        title="Analytics"
        meta="Acquisition, engagement, qualification, and consultation performance"
      />
      <AnalyticsCommandCenter report={report} tab={tab} />
    </V3Page>
  );
}
