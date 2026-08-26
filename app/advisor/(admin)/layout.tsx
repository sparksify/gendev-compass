import { notFound } from "next/navigation";
import { requireStaffUser } from "@/lib/advisor/auth";
import { isAdmin } from "@/lib/advisor/access";
import { getSiteLogoUrl } from "@/lib/assets";
import { AdvisorShell } from "@/components/advisor/AdvisorShell";
import { loadNavCounts } from "@/lib/advisor/navCounts";

export const dynamic = "force-dynamic";

/**
 * The admin sections (staff ADMIN role): /advisor/platform, its section
 * pages, and the Territory Advisor configuration. They now share the advisor
 * shell — the redesign has one rail with an ADMINISTRATION group, and each
 * section carries its own tab row inside the page header. Same
 * 404-for-unauthorized pattern as the rest of the advisor app.
 */
export default async function PlatformAdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaffUser();
  if (!isAdmin(user)) notFound();

  const [logoUrl, counts] = await Promise.all([getSiteLogoUrl(), loadNavCounts(user)]);

  return (
    <AdvisorShell logoUrl={logoUrl} userName={user.first_name} isAdmin counts={counts}>
      {children}
    </AdvisorShell>
  );
}
