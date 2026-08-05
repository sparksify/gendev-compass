"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/advisor", label: "Dashboard" },
  { href: "/advisor/investors", label: "Clients" },
];

/** Header nav with an active-route highlight. Client component only for usePathname. */
export function AdvisorNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1" aria-label="Main">
      {LINKS.map((link) => {
        const active =
          link.href === "/advisor" ? pathname === "/advisor" : pathname?.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-control px-3 py-1.5 text-sm font-medium transition-colors",
              active ? "bg-white/20 text-white" : "text-white/80 hover:bg-white/10 hover:text-white",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
