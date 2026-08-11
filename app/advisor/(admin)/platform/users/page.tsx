import type { Metadata } from "next";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { TeamPanel } from "@/components/advisor/TeamPanel";

export const metadata: Metadata = { title: "Users & Roles" };
export const dynamic = "force-dynamic";

/** Staff account management inside the admin dashboard. The (admin) layout
 * guarantees an ADMIN session, so the panel always gets admin powers here;
 * non-admin staff keep self-service access at /advisor/team. */
export default function AdminUsersPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <AdminPageHeader
        title="Users & Roles"
        description="Staff accounts for this dashboard — add members and manage access."
      />
      <TeamPanel isAdminUser />
    </div>
  );
}
