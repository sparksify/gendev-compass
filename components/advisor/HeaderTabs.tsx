"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export interface HeaderTab {
  href: string;
  label: string;
  /** Small filled count pill (amber when it means "waiting on you"). */
  badge?: number;
  badgeColor?: string;
  /** Highlight only on an exact path match. */
  exact?: boolean;
}

/**
 * The admin sections' tab row, rendered inside the page header block: 12.5/600
 * muted labels, the active one ink-bold with a 2px inset underline.
 */
export function HeaderTabs({ tabs }: { tabs: HeaderTab[] }) {
  const pathname = usePathname();

  return (
    <nav className="-mx-1 flex gap-x-6 overflow-x-auto px-1" aria-label="Sections">
      {tabs.map((tab) => {
        const active = tab.exact ? pathname === tab.href : Boolean(pathname?.startsWith(tab.href));
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-1.5 whitespace-nowrap pb-3 text-[14px] font-semibold transition-colors",
              active
                ? "font-bold text-foreground shadow-[inset_0_-2px_0_#101828]"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
            {tab.badge !== undefined && tab.badge > 0 && (
              <span
                className="tabular inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[11px] font-bold text-white"
                style={{ backgroundColor: tab.badgeColor ?? "#b45309" }}
              >
                {tab.badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
