"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, Map as MapIcon, LayoutGrid, UsersRound } from "lucide-react";
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

function navGroups(isAdmin: boolean): NavGroup[] {
  const groups: NavGroup[] = [
    {
      label: "Workspace",
      items: [
        { href: "/advisor", label: "Dashboard", icon: LayoutDashboard, exact: true },
        { href: "/advisor/investors", label: "Clients", icon: Users },
      ],
    },
  ];
  if (isAdmin) {
    groups.push({
      label: "Administration",
      items: [
        { href: "/advisor/territories", label: "Territories", icon: MapIcon },
        { href: "/advisor/platform", label: "Platform", icon: LayoutGrid },
      ],
    });
  }
  groups.push({
    label: "Organization",
    items: [{ href: "/advisor/team", label: "Team", icon: UsersRound }],
  });
  return groups;
}

function isActive(pathname: string | null, item: NavItem): boolean {
  if (!pathname) return false;
  return item.exact ? pathname === item.href : pathname.startsWith(item.href);
}

/** Identical row anatomy to the investor portal's SidebarNavigation, so every
 * dark rail in the app — investor portal, admin dashboard, advisor
 * workspace — reads as the same component family. */
function NavRow({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "sidebar-row group relative flex items-center gap-2.5 whitespace-nowrap border border-transparent px-2.5 py-2.5 text-[13px] font-medium",
        active
          ? "sidebar-row-active font-semibold text-white"
          : "text-sidebar-muted-foreground hover:bg-white/[0.03] hover:text-sidebar-foreground",
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
 * Full-page advisor workspace chrome: dark navy sidebar on the left (same
 * rail anatomy as PortalShell/AdminShell), slim header bar with the signed-in
 * user, content below. Every /advisor/(app) page (Dashboard, Clients,
 * Team, and — for admins — the Territories/Platform launch points) renders
 * inside this shell.
 */
export function AdvisorShell({
  brandBlock,
  userName,
  isAdmin,
  children,
}: {
  /** Server-rendered BrandBlock (components/layout/PortalShell) — same
   * lockup, size, and placement as every other rail in the app. */
  brandBlock: React.ReactNode;
  userName: string;
  isAdmin: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const groups = navGroups(isAdmin);
  const flatItems = groups.flatMap((group) => group.items);

  return (
    <div className="flex min-h-screen bg-surface">
      {/* Desktop sidebar. */}
      <aside className="sidebar-shell sticky top-0 hidden h-screen w-[236px] shrink-0 flex-col lg:flex">
        <div className="flex h-[59px] shrink-0 items-center border-b border-sidebar-border px-6">
          <Link href="/advisor">{brandBlock}</Link>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-5">
          <nav className="flex flex-col" aria-label="Advisor">
            {groups.map((group) => (
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
            <div className="sidebar-support-card rounded-card border p-4">
              <p className="flex items-center gap-2.5 text-[13.5px] font-bold text-sidebar-foreground">
                <span className="sidebar-support-icon flex size-8 shrink-0 items-center justify-center rounded-full border">
                  {userName.charAt(0).toUpperCase()}
                </span>
                {userName}
              </p>
              <p className="mt-2 text-[12.5px] text-sidebar-muted-foreground/70">
                {isAdmin ? "Administrator" : "Advisor"}
              </p>
              <LogoutButton
                variant="link"
                className="mt-2.5 h-auto p-0 text-[12.5px] font-medium text-sidebar-accent hover:text-white"
              />
            </div>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 border-b border-border bg-card shadow-sm">
          <div className="flex h-[59px] items-center justify-between gap-4 px-4 sm:px-6">
            <p className="text-sm text-muted-foreground">Advisor Workspace</p>
            <div className="flex shrink-0 items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-full bg-primary-soft text-[13px] font-semibold text-primary">
                  {userName.charAt(0).toUpperCase()}
                </span>
                <span className="hidden text-sm font-medium text-foreground sm:inline">{userName}</span>
              </div>
              <LogoutButton className="lg:hidden" />
            </div>
          </div>

          {/* Mobile nav: the sidebar collapses into a horizontally scrollable row. */}
          <nav
            className="flex gap-1 overflow-x-auto border-t border-border-soft px-3 py-2 lg:hidden"
            aria-label="Advisor sections"
          >
            {flatItems.map((item) => {
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
