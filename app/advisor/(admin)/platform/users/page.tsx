import type { Metadata } from "next";
import { PlatformPageShell } from "@/components/admin/PlatformPageShell";
import { TeamPanel } from "@/components/advisor/TeamPanel";

export const metadata: Metadata = { title: "Users & Roles" };
export const dynamic = "force-dynamic";

/** Staff account management inside the admin dashboard. The (admin) layout
 * guarantees an ADMIN session, so the panel always gets admin powers here;
 * non-admin staff keep self-service access at /advisor/team. */
export default function AdminUsersPage() {
  return (
    <PlatformPageShell
      title="Users & Roles"
      subtitle="Staff accounts for this dashboard — add members and manage access"
    >
      <div className="max-w-3xl">
        <TeamPanel isAdminUser />
      </div>
    </PlatformPageShell>
  );
}
