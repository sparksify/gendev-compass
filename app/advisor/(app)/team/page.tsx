import type { Metadata } from "next";
import { requireStaffUser } from "@/lib/advisor/auth";
import { isAdmin } from "@/lib/advisor/access";
import { TeamPanel } from "@/components/advisor/TeamPanel";

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
    <div className="mx-auto max-w-3xl">
      <h1 className="font-serif text-2xl font-semibold text-foreground">Team</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Staff accounts for this dashboard{isAdmin(user) ? " — add members and manage access" : ""}.
      </p>
      <div className="mt-6">
        <TeamPanel isAdminUser={isAdmin(user)} />
      </div>
    </div>
  );
}
