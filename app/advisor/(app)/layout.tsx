import Link from "next/link";
import { requireStaffUser } from "@/lib/advisor/auth";
import { LogoutButton } from "@/components/advisor/LogoutButton";
import { Badge } from "@/components/ui/badge";
import { brand } from "@/lib/config/brand";

export const dynamic = "force-dynamic";

/** Authenticated shell for every advisor/admin page. */
export default async function AdvisorAppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaffUser();

  return (
    <div className="min-h-screen bg-surface">
      <header className="sticky top-0 z-10 border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-6">
            <Link href="/advisor" className="font-serif text-lg font-semibold text-foreground">
              {brand.productName}
              <span className="ml-2 text-sm font-normal text-muted-foreground">Advisor</span>
            </Link>
            <nav className="flex items-center gap-1" aria-label="Main">
              <Link
                href="/advisor"
                className="rounded-control px-3 py-1.5 text-sm text-secondary-foreground hover:bg-surface"
              >
                Dashboard
              </Link>
              <Link
                href="/advisor/investors"
                className="rounded-control px-3 py-1.5 text-sm text-secondary-foreground hover:bg-surface"
              >
                Investors
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {user.first_name} {user.last_name}
            </span>
            <Badge variant={user.role === "ADMIN" ? "primary" : "neutral"}>{user.role}</Badge>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
