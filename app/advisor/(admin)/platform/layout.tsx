import { notFound } from "next/navigation";
import { requireStaffUser } from "@/lib/advisor/auth";
import { isAdmin } from "@/lib/advisor/access";
import { AdminShell } from "@/components/admin/AdminShell";
import { brand } from "@/lib/config/brand";

export const dynamic = "force-dynamic";

/**
 * The unified admin dashboard (staff ADMIN role), /advisor/platform and its
 * section pages. Lives in its own (admin) route group so it gets full-page
 * chrome (grouped dark sidebar + "Portal Admin" header) instead of the
 * shared advisor header. Same 404-for-unauthorized pattern as the rest of
 * the advisor app.
 */
export default async function PlatformAdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaffUser();
  if (!isAdmin(user)) notFound();

  return (
    <AdminShell brandName={brand.productName} userName={user.first_name}>
      {children}
    </AdminShell>
  );
}
