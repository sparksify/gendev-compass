import Link from "next/link";
import { requireStaffUser } from "@/lib/advisor/auth";
import { isAdmin } from "@/lib/advisor/access";
import { getSiteLogoUrl } from "@/lib/assets";
import { AdvisorNav } from "@/components/advisor/AdvisorNav";
import { LogoutButton } from "@/components/advisor/LogoutButton";
import { brand } from "@/lib/config/brand";

export const dynamic = "force-dynamic";

/** Authenticated shell for every advisor/admin page. */
export default async function AdvisorAppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaffUser();
  const logoUrl = await getSiteLogoUrl();
  const hasCustomLogo = logoUrl !== "/logo.svg";

  return (
    <div className="min-h-screen bg-surface">
      <header className="sticky top-0 z-10 border-b border-border bg-card shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-6">
            <Link href="/advisor" className="flex items-center gap-2.5">
              {hasCustomLogo ? (
                // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded asset
                <img src={logoUrl} alt={brand.brandName} className="h-9 w-auto max-w-[140px] object-contain" />
              ) : (
                <span className="font-serif text-lg font-semibold tracking-tight text-foreground">
                  {brand.productName}
                </span>
              )}
            </Link>
            <AdvisorNav isAdmin={isAdmin(user)} />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-full bg-primary-soft text-[13px] font-semibold text-primary">
                {user.first_name.charAt(0).toUpperCase()}
              </span>
              <span className="hidden text-sm font-medium text-foreground sm:inline">{user.first_name}</span>
            </div>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
