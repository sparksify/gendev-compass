import { notFound } from "next/navigation";
import { requireStaffUser } from "@/lib/advisor/auth";
import { isAdmin } from "@/lib/advisor/access";
import { TerritoryTabs } from "@/components/advisor/territories/TerritoryTabs";

export const dynamic = "force-dynamic";

/**
 * Admin-only Territory Advisor configuration. Same 404-for-unauthorized
 * pattern used for lead access elsewhere in the advisor app — a non-admin
 * staff member sees a plain not-found page, never a distinguishable
 * "forbidden" state.
 */
export default async function TerritoriesLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<Record<string, never>>;
}) {
  await params;
  const user = await requireStaffUser();
  if (!isAdmin(user)) notFound();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-foreground">Territory Advisor</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage territory records, state eligibility, and prospect search activity.
        </p>
      </div>
      <TerritoryTabs />
      {children}
    </div>
  );
}
