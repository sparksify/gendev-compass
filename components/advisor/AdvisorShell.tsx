"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  ChevronDown,
  LayoutDashboard,
  LayoutGrid,
  Map as MapIcon,
  Search,
  Users,
  UsersRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LogoutButton } from "@/components/advisor/LogoutButton";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  exact?: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

function navGroups(isAdmin: boolean): NavGroup[] {
  const groups: NavGroup[] = [
    {
      label: "Main",
      items: [
        { href: "/advisor", label: "Dashboard", icon: LayoutDashboard, exact: true },
        { href: "/advisor/investors", label: "Clients", icon: Users },
        { href: "/advisor/team", label: "Team", icon: UsersRound },
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
  return groups;
}

function isActive(pathname: string | null, item: NavItem): boolean {
  if (!pathname) return false;
  return item.exact ? pathname === item.href : pathname.startsWith(item.href);
}

/**
 * Advisor workspace chrome, per the client-panel handoff's visual system:
 * 216px navy-gradient rail with a blue brand tile, 56px white top bar with
 * client search, full-width content on the #f5f7fb ground. Deliberately no
 * longer matches the client-facing portal shell.
 */
export function AdvisorShell({
  logoUrl,
  userName,
  isAdmin,
  children,
}: {
  logoUrl: string;
  userName: string;
  isAdmin: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const groups = navGroups(isAdmin);
  const flatItems = groups.flatMap((group) => group.items);

  return (
    <div className="advisor-theme flex min-h-screen bg-surface">
      {/* Desktop rail */}
      <aside className="sticky top-0 hidden h-screen w-[216px] shrink-0 flex-col bg-[linear-gradient(180deg,#0e2149_0%,#0b1a3c_55%,#091430_100%)] lg:flex">
        <Link href="/advisor" className="flex items-center gap-2.5 px-4 pb-4 pt-5">
          <span className="flex size-[34px] shrink-0 items-center justify-center rounded-[10px] bg-[linear-gradient(135deg,#3b82f6,#2463eb)]">
            {/* Repo logo shown light on the blue tile. */}
            {/* eslint-disable-next-line @next/next/no-img-element -- dynamic
                admin-uploaded asset URL; plain img matches the old BrandBlock */}
            <img src={logoUrl} alt="" className="size-5 brightness-[2] invert" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[14.5px] font-bold text-white">GenDev Compass</span>
            <span className="block text-[10.5px] text-[#8fa3c8]">Franchise Platform</span>
          </span>
        </Link>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pb-4">
          <nav className="flex flex-col gap-1" aria-label="Advisor">
            {groups.map((group) => (
              <div key={group.label}>
                <p className="px-2 pb-1.5 pt-4 text-[10px] font-bold uppercase tracking-[0.14em] text-[#5f76a3]">
                  {group.label}
                </p>
                <ul className="flex flex-col gap-1">
                  {group.items.map((item) => {
                    const active = isActive(pathname, item);
                    const Icon = item.icon;
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "flex items-center gap-2.5 rounded-[9px] px-2.5 py-2 text-[13.5px] font-semibold transition-colors",
                            active
                              ? "bg-[rgb(59_130_246/0.22)] text-white shadow-[inset_0_0_0_1px_rgb(96_148_255/0.3)] font-bold"
                              : "text-[#a8b8d8] hover:bg-white/5 hover:text-white",
                          )}
                        >
                          <Icon className="size-4" strokeWidth={1.9} />
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>

          {/* Footer user chip */}
          <div className="mt-auto rounded-[11px] bg-white/5 p-3">
            <div className="flex items-center gap-2.5">
              <span className="relative flex size-8 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#3b82f6,#2463eb)] text-[13px] font-bold text-white">
                {userName.charAt(0).toUpperCase()}
                <span
                  aria-hidden
                  className="absolute -bottom-px -right-px size-2.5 rounded-full bg-[#22c55e] ring-2 ring-[#0b1a3c]"
                />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-bold text-white">{userName}</span>
                <span className="block text-[11px] text-[#8fa3c8]">
                  {isAdmin ? "Administrator" : "Advisor"}
                </span>
              </span>
            </div>
            <LogoutButton
              variant="link"
              className="mt-2 h-auto p-0 text-xs font-semibold text-[#a8b8d8] hover:text-white"
            />
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-border bg-card">
          <div className="flex h-14 items-center justify-between gap-4 px-4 sm:px-5">
            {/* Client search — submits to the Clients list. */}
            <form action="/advisor/investors" method="get" className="min-w-0 flex-1 sm:max-w-[340px]">
              <label className="flex items-center gap-2 rounded-[9px] border border-border bg-surface-raised px-3 py-2">
                <Search className="size-4 shrink-0 text-faint-foreground" />
                <input
                  type="search"
                  name="q"
                  placeholder="Search clients, brands…"
                  aria-label="Search clients"
                  className="w-full bg-transparent text-[13px] text-foreground placeholder:text-faint-foreground focus:outline-none"
                />
              </label>
            </form>
            <div className="flex shrink-0 items-center gap-3">
              <span className="relative flex size-9 items-center justify-center rounded-[9px] text-muted-foreground" title="Notifications">
                <Bell className="size-[17px]" strokeWidth={1.9} />
                <span aria-hidden className="absolute right-2 top-2 size-1.5 rounded-full bg-primary" />
              </span>
              <span className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-full bg-[linear-gradient(135deg,#3b82f6,#2463eb)] text-[13px] font-bold text-white">
                  {userName.charAt(0).toUpperCase()}
                </span>
                <span className="hidden text-[13px] font-semibold text-foreground sm:inline">{userName}</span>
                <ChevronDown className="hidden size-3.5 text-faint-foreground sm:inline" />
              </span>
              <LogoutButton className="lg:hidden" />
            </div>
          </div>

          {/* Mobile nav: the rail collapses into a scrollable chip row. */}
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
                    "shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
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

        <main className="w-full flex-1 px-4 pb-5 pt-4 sm:px-5">{children}</main>
      </div>
    </div>
  );
}
