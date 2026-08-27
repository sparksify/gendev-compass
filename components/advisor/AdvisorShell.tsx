"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardCheck,
  LayoutGrid,
  Map as MapIcon,
  PanelsTopLeft,
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
  /** Right-aligned faint count. */
  count?: number;
  /** Right-aligned filled ink pill — "these are waiting on you". */
  badge?: number;
}

export interface AdvisorNavCounts {
  clients: number;
  /** Questionnaires submitted in the last week — the unread pile. */
  questionnaires: number;
}

function navItems(isAdmin: boolean, counts: AdvisorNavCounts): NavItem[][] {
  const main: NavItem[] = [
    { href: "/advisor", label: "Overview", icon: PanelsTopLeft, exact: true },
    { href: "/advisor/investors", label: "Clients", icon: Users, count: counts.clients },
    {
      href: "/advisor/questionnaires",
      label: "Questionnaires",
      icon: ClipboardCheck,
      badge: counts.questionnaires,
    },
    { href: "/advisor/team", label: "Team", icon: UsersRound },
  ];
  if (!isAdmin) return [main];
  return [
    main,
    [
      { href: "/advisor/territories", label: "Territories", icon: MapIcon },
      { href: "/advisor/platform", label: "Platform", icon: LayoutGrid },
    ],
  ];
}

function isActive(pathname: string | null, item: NavItem): boolean {
  if (!pathname) return false;
  return item.exact ? pathname === item.href : pathname.startsWith(item.href);
}

/**
 * Advisor workspace chrome (v3): a white 212px rail against the green canvas,
 * with the active row marked by green type plus a 2px inset spine. Pages
 * supply their own header inside the content column (components/advisor/v3),
 * so the rail carries navigation and nothing else.
 */
export function AdvisorShell({
  logoUrl,
  userName,
  isAdmin,
  counts,
  children,
}: {
  logoUrl: string;
  userName: string;
  isAdmin: boolean;
  counts: AdvisorNavCounts;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const groups = navItems(isAdmin, counts);
  const flatItems = groups.flat();

  return (
    <div className="advisor-theme flex min-h-screen bg-background">
      {/* Desktop rail */}
      <aside className="sticky top-0 hidden h-screen w-[212px] shrink-0 flex-col border-r border-border bg-card pb-5 pt-[26px] lg:flex">
        <Link href="/advisor" className="flex items-center gap-2.5 px-[22px] pb-[30px]">
          {/* eslint-disable-next-line @next/next/no-img-element -- dynamic
              admin-uploaded asset URL; shown in its natural color on white */}
          <img src={logoUrl} alt="" className="size-[22px] shrink-0" />
          <span className="text-[15.5px] leading-[1.45] font-extrabold tracking-[-0.02em] text-foreground">Compass</span>
        </Link>

        <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto" aria-label="Advisor">
          {groups.map((items, index) => (
            <div key={index}>
              {index > 0 && (
                <p className="px-[22px] pb-2 pt-5 text-[11px] font-bold uppercase tracking-[0.14em] text-ghost-foreground">
                  Administration
                </p>
              )}
              {items.map((item) => {
                const active = isActive(pathname, item);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-[11px] px-[22px] py-[9px] text-[14.5px] transition-colors",
                      active
                        ? "bg-primary-soft font-bold text-primary shadow-[inset_2px_0_0_var(--primary)]"
                        : "font-medium text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Icon className="size-[15px] shrink-0" strokeWidth={1.8} />
                    {item.label}
                    {item.count !== undefined && (
                      <span className="tabular ml-auto text-[12px] font-bold text-faint-foreground">
                        {item.count}
                      </span>
                    )}
                    {item.badge !== undefined && item.badge > 0 && (
                      <span className="ml-auto inline-flex size-4 items-center justify-center rounded-full bg-accent text-[11px] font-extrabold text-accent-foreground">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer user chip */}
        <div className="mx-[22px] mt-auto border-t border-border pt-[18px]">
          <div className="flex items-center gap-2.5">
            <span className="flex size-[30px] shrink-0 items-center justify-center rounded-full bg-primary-soft text-[13.5px] leading-[1.45] font-extrabold text-primary">
              {userName.charAt(0).toUpperCase()}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[14px] font-bold text-foreground">{userName}</span>
              <span className="block text-[12px] text-faint-foreground">
                {isAdmin ? "Administrator" : "Advisor"}
              </span>
            </span>
          </div>
          <LogoutButton
            variant="link"
            className="mt-2 h-auto p-0 text-[13px] font-semibold text-faint-foreground hover:text-foreground"
          />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile nav: the rail collapses into a scrollable chip row. */}
        <nav
          className="flex gap-1.5 overflow-x-auto border-b border-border bg-card px-4 py-2.5 lg:hidden"
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
                  "shrink-0 rounded-pill px-3.5 py-1.5 text-[12.5px] font-bold transition-colors",
                  active
                    ? "bg-primary text-white"
                    : "border border-border bg-card text-secondary-foreground hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            );
          })}
          <LogoutButton className="ml-auto shrink-0" />
        </nav>

        {children}
      </div>
    </div>
  );
}
