"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export interface HeaderTab {
  href: string;
  label: string;
  /** Small count pill (yellow when it means "waiting on you"). */
  badge?: number;
  badgeColor?: string;
  /** Highlight only on an exact path match. */
  exact?: boolean;
}

/**
 * The section tab row (v3): 13/600 muted labels on a hairline, the active one
 * ink-bold over a 2.5px yellow underline that sits on the rule itself.
 */
export function HeaderTabs({ tabs }: { tabs: HeaderTab[] }) {
  const pathname = usePathname();

  return (
    <nav
      className="-mb-px flex gap-1 overflow-x-auto border-b border-border"
      aria-label="Sections"
    >
      {tabs.map((tab) => {
        const active = tab.exact ? pathname === tab.href : Boolean(pathname?.startsWith(tab.href));
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-[2.5px] px-3 pb-[9px] pt-2 text-[13px] transition-colors",
              active
                ? "border-accent font-extrabold text-foreground"
                : "border-transparent font-semibold text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
            {tab.badge !== undefined && tab.badge > 0 && (
              <span
                className="tabular inline-flex h-4 min-w-4 items-center justify-center rounded-pill px-1 text-[10px] font-extrabold"
                style={{
                  backgroundColor: tab.badgeColor ?? "var(--accent)",
                  color: tab.badgeColor ? "#ffffff" : "var(--accent-foreground)",
                }}
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
