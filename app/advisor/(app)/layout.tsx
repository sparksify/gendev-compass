import { requireStaffUser } from "@/lib/advisor/auth";
import { isAdmin } from "@/lib/advisor/access";
import { getSiteLogoUrl } from "@/lib/assets";
import { brand } from "@/lib/config/brand";
import { AdvisorShell } from "@/components/advisor/AdvisorShell";
import { loadNavCounts } from "@/lib/advisor/navCounts";

export const dynamic = "force-dynamic";

/** Authenticated shell for every advisor/admin page. */
export default async function AdvisorAppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaffUser();
  const [logoUrl, counts] = await Promise.all([getSiteLogoUrl(), loadNavCounts(user)]);

  return (
    <AdvisorShell
      logoUrl={logoUrl}
      orgName={brand.orgName}
      userName={user.first_name}
      isAdmin={isAdmin(user)}
      counts={counts}
    >
      {children}
    </AdvisorShell>
  );
}
