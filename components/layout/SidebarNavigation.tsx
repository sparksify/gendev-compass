"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  LineChart,
  Building2,
  HelpCircle,
  FolderOpen,
  CalendarDays,
  Headphones,
  Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { COMING_SOON } from "@/lib/config/content";

interface SidebarNavigationProps {
  token: string;
  firstName: string;
  supportEmail: string;
  /** True once the prospect can reach the scheduling / consultation page. */
  consultationAvailable: boolean;
}

export function SidebarNavigation({
  token,
  firstName,
  supportEmail,
  consultationAvailable,
}: SidebarNavigationProps) {
  const pathname = usePathname();
  const base = `/p/${token}`;

  const items = [
    { label: "Your Investment Journey", href: base, icon: Home, exact: true },
    { label: "My Progress", href: `${base}#progress`, icon: LineChart, anchor: true },
    { label: "Opportunity Overview", href: `${base}/overview`, icon: Building2 },
    { label: "Investor FAQ", href: `${base}#faq`, icon: HelpCircle, anchor: true },
    { label: "Resources", href: `${base}#resources`, icon: FolderOpen, anchor: true },
    {
      label: "My Consultation",
      href: consultationAvailable ? `${base}/schedule` : null,
      icon: CalendarDays,
      lockNote: "Unlocks after qualification",
    },
  ];

  return (
    <nav aria-label="Portal navigation" className="flex min-h-full flex-col gap-6">
      <div className="px-3 pt-1">
        <p className="text-sm text-muted-foreground">Welcome back,</p>
        <p className="font-serif text-2xl font-semibold leading-snug text-foreground">
          {firstName}
        </p>
      </div>

      <ul className="space-y-1">
        {items.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : !item.anchor && item.href !== null && pathname.startsWith(item.href);
          const Icon = item.icon;

          if (item.href === null) {
            return (
              <li key={item.label}>
                <span
                  className="flex cursor-not-allowed items-center gap-3 rounded-control px-3 py-2 text-[13px] text-muted-foreground/70"
                  title={item.lockNote}
                >
                  <Icon className="size-4 shrink-0" strokeWidth={1.75} />
                  <span className="flex-1">{item.label}</span>
                  <Lock className="size-3.5" aria-label={item.lockNote} />
                </span>
              </li>
            );
          }

          return (
            <li key={item.label}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-control px-3 py-2 text-[13px] transition-colors",
                  active
                    ? "bg-primary-soft font-medium text-primary"
                    : "text-muted-foreground hover:bg-surface hover:text-foreground",
                )}
              >
                <Icon
                  className={cn("size-4 shrink-0", active ? "text-primary" : "text-muted-foreground")}
                  strokeWidth={1.75}
                />
                {item.label}
              </Link>
            </li>
          );
        })}
        <li>
          <a
            href={`mailto:${supportEmail}`}
            className="flex items-center gap-3 rounded-control px-3 py-2 text-[13px] text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
          >
            <Headphones className="size-4 shrink-0" strokeWidth={1.75} />
            Support
          </a>
        </li>
      </ul>

      <div className="border-t border-border pt-5">
        <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Coming Soon
        </p>
        <ul className="mt-2 space-y-1">
          {COMING_SOON.slice(0, 2).map((item) => (
            <li
              key={item.key}
              className="flex items-center gap-3 rounded-control px-3 py-2 text-[13px] text-muted-foreground/60"
            >
              <Lock className="size-3.5 shrink-0" />
              {item.title}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-auto rounded-card bg-surface p-4">
        <p className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Headphones className="size-4 text-muted-foreground" strokeWidth={1.75} />
          Need Assistance?
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
          Our team is here to help.
        </p>
        <a
          href={`mailto:${supportEmail}`}
          className="mt-2 inline-block text-[13px] font-medium text-primary hover:underline"
        >
          Contact Support →
        </a>
      </div>
    </nav>
  );
}
