import type { Metadata } from "next";
import { requireStaffUser } from "@/lib/advisor/auth";
import { isAdmin } from "@/lib/advisor/access";
import { TeamPanel } from "@/components/advisor/TeamPanel";
import { PageTitle, V3Page } from "@/components/advisor/v3";

export const metadata: Metadata = { title: "Team" };
export const dynamic = "force-dynamic";

/**
 * Team management inside the unified staff dashboard. Admins see the
 * member list and can add accounts; every signed-in staff member can
 * change their own password here.
 */
export default async function TeamPage() {
  const user = await requireStaffUser();

  return (
    <V3Page width="narrow">
      <PageTitle
        title="Team"
        meta={`Staff accounts for this dashboard${isAdmin(user) ? " — add members and manage access" : ""}`}
      />
      <TeamPanel isAdminUser={isAdmin(user)} />
    </V3Page>
  );
}
