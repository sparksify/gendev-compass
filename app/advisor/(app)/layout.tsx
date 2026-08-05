import Link from "next/link";
import { requireStaffUser } from "@/lib/advisor/auth";
import { getSiteLogoUrl } from "@/lib/assets";
import { AdvisorNav } from "@/components/advisor/AdvisorNav";
import { LogoutButton } from "@/components/advisor/LogoutButton";
import { brand } from "@/lib/config/brand";

export const dynamic = "force-dynamic";

const HEADER_GRADIENT = {
  background: "linear-gradient(135deg, var(--primary), color-mix(in srgb, var(--primary) 55%, black))",
};

/** Authenticated shell for every advisor/admin page. */
export default async function AdvisorAppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaffUser();
  const logoUrl = await getSiteLogoUrl();
  const hasCustomLogo = logoUrl !== "/logo.svg";

  return (
    <div className="min-h-screen bg-surface">
      <header className="sticky top-0 z-10 text-white shadow-sm" style={HEADER_GRADIENT}>
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-6">
            <Link href="/advisor" className="flex items-center gap-2.5">
              {hasCustomLogo ? (
                <span className="flex h-9 items-center rounded-md bg-white/95 px-2 py-1 shadow-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element -- admin-uploaded asset */}
                  <img src={logoUrl} alt={brand.brandName} className="h-full w-auto max-w-[120px] object-contain" />
                </span>
              ) : (
                <span className="font-serif text-lg font-semibold tracking-tight">{brand.productName}</span>
              )}
            </Link>
            <AdvisorNav />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-full bg-white/20 text-[13px] font-semibold">
                {user.first_name.charAt(0).toUpperCase()}
              </span>
              <span className="hidden text-sm font-medium sm:inline">{user.first_name}</span>
            </div>
            <LogoutButton className="text-white/85 hover:bg-white/15 hover:text-white" />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
