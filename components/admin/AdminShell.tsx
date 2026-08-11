"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
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
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
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

/** Identical row anatomy to the investor portal's SidebarNavigation, so the
 * two dark rails read as the same component family. */
function NavRow({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "sidebar-row group relative flex items-center gap-2.5 whitespace-nowrap border border-transparent px-2.5 py-2.5 text-[12.5px]",
        active
          ? "sidebar-row-active font-medium text-sidebar-foreground"
          : "text-sidebar-muted-foreground/72 hover:bg-white/[0.03] hover:text-sidebar-foreground/90",
      )}
    >
      {active && (
        <span
          aria-hidden
          className="sidebar-indicator absolute -left-[10px] top-1/2 h-[55%] w-[3px] -translate-y-1/2 rounded-full"
        />
      )}
      <span
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-full border border-transparent transition-colors duration-200",
          active
            ? "sidebar-icon-active text-white"
            : "text-sidebar-muted-foreground/60 group-hover:bg-white/[0.04] group-hover:text-sidebar-foreground/85",
        )}
      >
        <Icon className="size-[15px]" strokeWidth={1.7} />
      </span>
      {item.label}
    </Link>
  );
}

/**
 * Full-page admin dashboard chrome: dark navy grouped sidebar on the left,
 * "Portal Admin" header bar on top, content below. Replaces the shared
 * advisor header for everything under /advisor/platform.
 */
export function AdminShell({
  brandBlock,
  userName,
  children,
}: {
  /** Server-rendered BrandBlock (components/layout/PortalShell) — the same
   * lockup, size, and placement as the investor portal's rail, so the logo
   * never shifts between surfaces. */
  brandBlock: React.ReactNode;
  userName: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-surface">
      {/* Desktop sidebar — same rail anatomy as PortalShell: 236px,
          59px bordered brand header, scrollable nav column. */}
      <aside className="sidebar-shell sticky top-0 hidden h-screen w-[236px] shrink-0 flex-col lg:flex">
        <div className="flex h-[59px] shrink-0 items-center border-b border-sidebar-border px-6">
          <Link href="/advisor/platform">{brandBlock}</Link>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-5">
          <nav className="flex flex-col" aria-label="Admin">
            {NAV_GROUPS.map((group) => (
              <div key={group.label}>
                <p className="px-5 pb-2.5 pt-5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-sidebar-muted-foreground/55">
                  {group.label}
                </p>
                <ul className="flex flex-col gap-1.5 px-3">
                  {group.items.map((item) => (
                    <li key={item.href}>
                      <NavRow item={item} active={isActive(pathname, item)} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>

          <div className="mt-auto px-5 pt-5">
            <Link
              href="/advisor"
              className="sidebar-row sidebar-support-card flex items-center gap-2.5 border p-4 text-[13px] font-medium text-sidebar-foreground"
            >
              <ArrowLeft className="size-4 shrink-0" />
              Back to Advisor
            </Link>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 border-b border-border bg-card shadow-sm">
          <div className="flex h-[59px] items-center justify-between gap-4 px-4 sm:px-6">
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
