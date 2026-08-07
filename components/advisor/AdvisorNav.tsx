"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/advisor", label: "Dashboard" },
  { href: "/advisor/investors", label: "Clients" },
];

const ADMIN_LINKS = [
  { href: "/advisor/territories", label: "Territories" },
  { href: "/advisor/tracking", label: "Tracking & Attribution" },
  { href: "/advisor/platform", label: "Platform" },
];

/** Team is visible to everyone (self-service password change lives there). */
const SHARED_LINKS = [{ href: "/advisor/team", label: "Team" }];

/** Header nav with an active-route highlight. Client component only for usePathname. */
export function AdvisorNav({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const links = isAdmin ? [...LINKS, ...ADMIN_LINKS, ...SHARED_LINKS] : [...LINKS, ...SHARED_LINKS];

  return (
    <nav className="flex items-center gap-1" aria-label="Main">
      {links.map((link) => {
        const active =
          link.href === "/advisor" ? pathname === "/advisor" : pathname?.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-control px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-primary-soft text-primary"
                : "text-secondary-foreground hover:bg-surface hover:text-foreground",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
