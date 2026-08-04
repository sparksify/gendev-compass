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
    <nav aria-label="Portal navigation" className="flex min-h-full flex-col">
      <div className="px-5 pb-3.5 pt-[22px]">
        <p className="text-[13.5px] text-muted-foreground">Welcome back,</p>
        <p className="mt-0.5 font-serif text-2xl leading-[1.2] text-foreground">{firstName}</p>
      </div>

      <ul className="flex flex-col gap-0.5 px-3 pt-1">
        {items.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : !item.anchor && item.href !== null && pathname.startsWith(item.href);
          const Icon = item.icon;

          if (item.href === null) {
            return (
              <li key={item.label}>
                <span
                  className="flex cursor-not-allowed items-center gap-3 rounded-control border border-transparent px-3 py-[11px] text-[13px] text-faint-foreground"
                  title={item.lockNote}
                >
                  <Icon className="size-[17px] shrink-0" strokeWidth={1.7} />
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
                  "flex items-center gap-3 rounded-control border px-3 py-[11px] text-[13px] transition-colors",
                  active
                    ? "border-primary-soft-border bg-primary-soft font-medium text-primary"
                    : "border-transparent text-secondary-foreground hover:bg-surface",
                )}
              >
                <Icon
                  className={cn(
                    "size-[17px] shrink-0",
                    active ? "text-primary" : "text-[#475467]",
                  )}
                  strokeWidth={1.7}
                />
                {item.label}
              </Link>
            </li>
          );
        })}
        <li>
          <a
            href={`mailto:${supportEmail}`}
            className="flex items-center gap-3 rounded-control border border-transparent px-3 py-[11px] text-[13px] text-secondary-foreground transition-colors hover:bg-surface"
          >
            <Headphones className="size-[17px] shrink-0 text-[#475467]" strokeWidth={1.7} />
            Support
          </a>
        </li>
      </ul>

      <div className="mx-5 mt-[22px] border-t border-border" />
      <p className="px-5 pb-2.5 pt-5 text-[10.5px] font-bold uppercase tracking-[0.13em] text-faint-foreground">
        Coming Soon
      </p>
      <ul className="flex flex-col gap-1 px-3">
        {[COMING_SOON[0], COMING_SOON[2]].map((item) => (
          <li
            key={item.key}
            className="flex items-center gap-3 whitespace-nowrap px-3 py-[9px] text-[13px] text-faint-foreground"
          >
            <Lock className="size-[15px] shrink-0" strokeWidth={1.8} />
            {item.shortTitle ?? item.title}
          </li>
        ))}
      </ul>

      <div className="mt-auto px-5 pt-5">
        <div className="rounded-card border border-border bg-surface-raised p-4">
          <p className="flex items-center gap-2 text-[13.5px] font-bold text-foreground">
            <Headphones className="size-4 text-foreground" strokeWidth={1.7} />
            Need Assistance?
          </p>
          <p className="mt-2 text-[12.5px] text-muted-foreground">Our team is here to help.</p>
          <a
            href={`mailto:${supportEmail}`}
            className="mt-2.5 inline-block text-[12.5px] font-medium text-primary hover:text-primary-hover"
          >
            Contact Support →
          </a>
        </div>
      </div>
    </nav>
  );
}
