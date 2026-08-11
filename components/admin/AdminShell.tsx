"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Compass,
  LayoutDashboard,
  Palette,
  FolderOpen,
  Map as MapIcon,
  MapPin,
  Database,
  FlaskConical,
  FileText,
  Users,
  UserCog,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LogoutButton } from "@/components/advisor/LogoutButton";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Highlight only on an exact path match (for the Dashboard index). */
  exact?: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

/**
 * Grouped by what an admin is working on. Every destination renders inside
 * this shell: Territory Data lives in the same (admin) route group, and
 * Investors / Users & Roles have admin-hosted routes under /advisor/platform
 * that reuse the advisor app's components.
 */
const NAV_GROUPS: NavGroup[] = [
  {
    label: "Admin Overview",
    items: [{ href: "/advisor/platform", label: "Dashboard", icon: LayoutDashboard, exact: true }],
  },
  {
    label: "Content Management",
    items: [
      { href: "/advisor/platform/resources", label: "Resources", icon: FolderOpen },
      { href: "/advisor/platform/branding", label: "Branding & Assets", icon: Palette },
    ],
  },
  {
    label: "Data & Integrations",
    items: [
      { href: "/advisor/territories", label: "Territory Data", icon: MapIcon },
      { href: "/advisor/platform/zip-data", label: "ZIP & Geo Data", icon: MapPin },
      { href: "/advisor/platform/census-health", label: "Census Data Health", icon: Database },
    ],
  },
  {
    label: "Lead Management",
    items: [
      { href: "/advisor/platform/test-leads", label: "Test Leads", icon: FlaskConical },
      { href: "/advisor/platform/fdd", label: "FDD Requests", icon: FileText },
      { href: "/advisor/platform/investors", label: "Investors", icon: Users },
    ],
  },
  {
    label: "System",
    items: [{ href: "/advisor/platform/users", label: "Users & Roles", icon: UserCog }],
  },
];

function isActive(pathname: string | null, item: NavItem): boolean {
  if (!pathname) return false;
  return item.exact ? pathname === item.href : pathname.startsWith(item.href);
}

function NavRow({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "sidebar-row relative flex items-center gap-2.5 border border-transparent px-3 py-2 text-[13px] font-medium",
        active
          ? "sidebar-row-active text-white"
          : "text-sidebar-muted-foreground hover:bg-white/5 hover:text-sidebar-foreground",
      )}
    >
      {active && (
        <span className="sidebar-indicator absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full" />
      )}
      <Icon className="size-4 shrink-0" />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

/**
 * Full-page admin dashboard chrome: dark navy grouped sidebar on the left,
 * "Portal Admin" header bar on top, content below. Replaces the shared
 * advisor header for everything under /advisor/platform.
 */
export function AdminShell({
  brandName,
  logoUrl,
  userName,
  children,
}: {
  brandName: string;
  /** Admin-uploaded site logo; null falls back to the compass wordmark. */
  logoUrl: string | null;
  userName: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-surface">
      {/* Desktop sidebar */}
      <aside className="sidebar-shell sticky top-0 hidden h-screen w-60 shrink-0 flex-col overflow-y-auto lg:flex">
        <Link
          href="/advisor/platform"
          className="flex items-center gap-2.5 px-5 pb-5 pt-6 text-sidebar-foreground"
        >
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded asset
            <img
              src={logoUrl}
              alt={brandName}
              className="h-9 w-auto max-w-[170px] rounded bg-white/90 object-contain px-1.5 py-1"
            />
          ) : (
            <>
              <span className="flex size-9 items-center justify-center rounded-full border border-white/15 bg-white/5">
                <Compass className="size-5" />
              </span>
              <span className="font-serif text-lg font-semibold tracking-tight">{brandName}</span>
            </>
          )}
        </Link>

        <nav className="flex-1 space-y-5 px-3 pb-4" aria-label="Admin">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="px-3 pb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-sidebar-muted-foreground/60">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <NavRow key={item.href} item={item} active={isActive(pathname, item)} />
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="px-3 pb-5">
          <Link
            href="/advisor"
            className="sidebar-row sidebar-support-card flex items-center gap-2.5 border px-3 py-2.5 text-[13px] font-medium text-sidebar-foreground"
          >
            <ArrowLeft className="size-4 shrink-0" />
            Back to Advisor
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 border-b border-border bg-card shadow-sm">
          <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <div className="flex min-w-0 items-baseline gap-3">
              <h1 className="shrink-0 text-base font-semibold text-foreground">Portal Admin</h1>
              <p className="hidden truncate text-sm text-muted-foreground sm:block">
                Platform management and configuration
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-full bg-primary-soft text-[13px] font-semibold text-primary">
                  {userName.charAt(0).toUpperCase()}
                </span>
                <span className="hidden text-sm font-medium text-foreground sm:inline">{userName}</span>
              </div>
              <LogoutButton />
            </div>
          </div>

          {/* Mobile nav: the sidebar collapses into a horizontally scrollable row. */}
          <nav
            className="flex gap-1 overflow-x-auto border-t border-border-soft px-3 py-2 lg:hidden"
            aria-label="Admin sections"
          >
            {NAV_GROUPS.flatMap((group) => group.items).map((item) => {
              const active = isActive(pathname, item);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "shrink-0 rounded-control px-3 py-1.5 text-xs font-medium transition-colors",
                    active
                      ? "bg-primary-soft text-primary"
                      : "text-secondary-foreground hover:bg-surface hover:text-foreground",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
