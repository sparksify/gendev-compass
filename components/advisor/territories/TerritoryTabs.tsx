"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/advisor/territories/records", label: "Territory Records" },
  { href: "/advisor/territories/eligibility", label: "State Eligibility" },
  { href: "/advisor/territories/searches", label: "Search Activity" },
  { href: "/advisor/territories/reviews", label: "Review Requests" },
  { href: "/advisor/territories/settings", label: "Settings" },
];

export function TerritoryTabs() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap gap-1 border-b border-border" aria-label="Territory Advisor sections">
      {TABS.map((tab) => {
        const active = pathname?.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "border-b-2 px-3.5 py-2.5 text-[13.5px] font-medium transition-colors",
              active
                ? "border-primary text-primary"
                : "border-transparent text-secondary-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
