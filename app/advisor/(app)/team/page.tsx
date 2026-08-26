import type { Metadata } from "next";
import { requireStaffUser } from "@/lib/advisor/auth";
import { isAdmin } from "@/lib/advisor/access";
import { TeamPanel } from "@/components/advisor/TeamPanel";
import { PageBody, PageHeader } from "@/components/advisor/PageHeader";

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
    <>
      <PageHeader
        title="Team"
        subtitle={`Staff accounts for this dashboard${isAdmin(user) ? " — add members and manage access" : ""}`}
      />
      <PageBody>
        <div className="max-w-3xl">
          <TeamPanel isAdminUser={isAdmin(user)} />
        </div>
      </PageBody>
    </>
  );
}
