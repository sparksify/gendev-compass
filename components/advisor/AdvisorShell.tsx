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
import { LogoutIconButton } from "@/components/advisor/LogoutButton";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  exact?: boolean;
  /** Right-aligned faint count. */
  count?: number;
  /** Right-aligned yellow pill — "these are waiting on you". */
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

/** One pill-shaped nav row on the ink ground. */
function NavRow({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-2.5 rounded-pill px-3.5 py-[9px] text-[13px] transition-colors duration-[120ms]",
        active
          ? "bg-[#1b7a61] font-extrabold text-white shadow-[0_2px_8px_rgba(27,122,97,.4)]"
          : "font-semibold text-[#aab8b1] hover:bg-[#212824]",
      )}
    >
      <Icon className="size-3.5 shrink-0" strokeWidth={2} />
      {item.label}
      {item.count !== undefined && (
        <span className="tabular ml-auto text-[11px] font-bold text-[#5f6e67]">{item.count}</span>
      )}
      {item.badge !== undefined && item.badge > 0 && (
        <span className="tabular ml-auto inline-flex h-4 min-w-4 items-center justify-center rounded-pill bg-accent px-1 text-[10px] font-extrabold text-accent-foreground">
          {item.badge}
        </span>
      )}
    </Link>
  );
}

/**
 * Advisor workspace chrome — the "Ink" sidebar (v3 handoff, option 1b): a
 * 246px #181d1b rail carrying the logo lockup, pill-shaped nav (the active
 * route filled brand green), and the signed-in user pinned to the bottom.
 * One component, so the black rail lands on every advisor screen at once.
 *
 * The rail is the one advisor surface that reverses out of the light theme,
 * so its grays are spelled out here rather than read from tokens: #212824
 * hover, #262d29 divider, #2a3430 avatar, #aab8b1 inactive, #8fa098 muted,
 * #5f6e67 faint.
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
      <aside className="sticky top-0 hidden h-screen w-[246px] shrink-0 flex-col bg-[#181d1b] px-3 pb-4 pt-[18px] lg:flex">
        <Link href="/advisor" aria-label="Overview" className="mx-1 mb-4 block">
          {/* eslint-disable-next-line @next/next/no-img-element -- dynamic
              admin-uploaded asset, shown alone at its natural proportions —
              no tile, no wordmark */}
          <img
            src={logoUrl}
            alt=""
            className="h-10 w-auto max-w-full object-contain object-left"
          />
        </Link>

        <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto" aria-label="Advisor">
          {groups.map((items, index) => (
            <div key={index} className="flex flex-col gap-[3px]">
              {index > 0 && (
                <p className="mx-3.5 mb-1 mt-[18px] text-[9.5px] font-extrabold uppercase tracking-[0.14em] text-[#5f6e67]">
                  Administration
                </p>
              )}
              {items.map((item) => (
                <NavRow key={item.href} item={item} active={isActive(pathname, item)} />
              ))}
            </div>
          ))}
        </nav>

        {/* Footer user chip */}
        <div className="mt-auto flex items-center gap-[9px] border-t border-[#262d29] pt-3">
          <span
            aria-hidden
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#2a3430] text-[11.5px] font-extrabold text-accent"
          >
            {userName.charAt(0).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12.5px] font-bold text-white">{userName}</span>
            <span className="block text-[10.5px] font-semibold text-[#8fa098]">
              {isAdmin ? "Administrator" : "Advisor"}
            </span>
          </span>
          <LogoutIconButton />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile nav: the rail collapses into a scrollable ink chip row. */}
        <nav
          className="flex items-center gap-1.5 overflow-x-auto bg-[#181d1b] px-4 py-2.5 lg:hidden"
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
                  "shrink-0 rounded-pill px-3.5 py-1.5 text-[12.5px] transition-colors duration-[120ms]",
                  active
                    ? "bg-[#1b7a61] font-extrabold text-white"
                    : "border border-[#262d29] font-semibold text-[#aab8b1] hover:bg-[#212824]",
                )}
              >
                {item.label}
              </Link>
            );
          })}
          <LogoutIconButton className="ml-auto" />
        </nav>

        {children}
      </div>
    </div>
  );
}
