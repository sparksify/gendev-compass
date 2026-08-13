import { requireStaffUser } from "@/lib/advisor/auth";
import { isAdmin } from "@/lib/advisor/access";
import { getSiteLogoUrl } from "@/lib/assets";
import { AdvisorShell } from "@/components/advisor/AdvisorShell";
import { BrandBlock } from "@/components/layout/PortalShell";

export const dynamic = "force-dynamic";

/** Authenticated shell for every advisor/admin page. */
export default async function AdvisorAppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaffUser();
  const logoUrl = await getSiteLogoUrl();

  return (
    <AdvisorShell
      brandBlock={<BrandBlock logoUrl={logoUrl} variant="sidebar" />}
      userName={user.first_name}
      isAdmin={isAdmin(user)}
    >
      {children}
    </AdvisorShell>
  );
}
