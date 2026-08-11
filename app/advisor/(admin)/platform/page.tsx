import type { Metadata } from "next";
import { requireStaffUser } from "@/lib/advisor/auth";
import { loadInvestorRows } from "@/lib/advisor/investors";
import { AdminOverviewPanels } from "@/components/admin/AdminOverviewPanels";

export const metadata: Metadata = { title: "Portal Admin Dashboard" };
export const dynamic = "force-dynamic";

function withinDays(iso: string | null | undefined, days: number, now: Date): boolean {
  if (!iso) return false;
  return now.getTime() - new Date(iso).getTime() <= days * 86_400_000;
}

/**
 * Admin overview: investor KPIs are computed server-side from the same
 * rows the advisor dashboard uses; the operational panels (FDD, census
 * health, portal assets) fetch client-side from the existing admin APIs.
 */
export default async function PlatformDashboardPage() {
  const user = await requireStaffUser();
  const rows = await loadInvestorRows(user);
  const now = new Date();

  const newThisWeek = rows.filter((r) => withinDays(r.lead.created_at, 7, now)).length;
  const activeJourneys = rows.filter((r) => withinDays(r.lastActivityAt, 7, now)).length;
  const fddRequested = rows.filter((r) => r.fddStatus !== "not_requested").length;
  const fddInFlight = rows.filter(
    (r) =>
      r.fddStatus !== "not_requested" &&
      r.fddStatus !== "fdd_received" &&
      r.fddStatus !== "waiting_period_active" &&
      r.fddStatus !== "eligible_for_agreement",
  ).length;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Welcome back, {user.first_name}</p>
        <h2 className="mt-0.5 font-serif text-2xl font-semibold text-foreground">
          Portal Admin Dashboard
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your portal content, data, and platform settings.
        </p>
      </div>

      <AdminOverviewPanels
        stats={{
          totalInvestors: rows.length,
          newThisWeek,
          activeJourneys,
          fddRequested,
          fddInFlight,
        }}
      />
    </div>
  );
}
