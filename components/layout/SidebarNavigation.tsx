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
  Compass,
  Headphones,
  Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { COMING_SOON } from "@/lib/config/content";

interface SidebarNavigationProps {
  token: string;
  supportEmail: string;
  /** True once the prospect can reach the scheduling / consultation page. */
  consultationAvailable: boolean;
}

export function SidebarNavigation({
  token,
  supportEmail,
  consultationAvailable,
}: SidebarNavigationProps) {
  const pathname = usePathname();
  const base = `/p/${token}`;

  const items = [
    { label: "Your Investment Journey", href: base, icon: Home, exact: true },
    { label: "My Progress", href: `${base}#progress`, icon: LineChart, anchor: true },
    { label: "Opportunity Overview", href: `${base}/opportunity`, icon: Building2 },
    { label: "Territory Intelligence", href: `${base}/territory-advisor`, icon: Compass },
    { label: "Investor FAQ", href: `${base}#faq`, icon: HelpCircle, anchor: true },
    { label: "Resources", href: `${base}/opportunity#documents`, icon: FolderOpen, anchor: true },
    {
      label: "My Consultation",
      href: consultationAvailable ? `${base}/schedule` : null,
      icon: CalendarDays,
      lockNote: "Available after your questionnaire",
    },
  ];

  return (
    <nav aria-label="Portal navigation" className="flex min-h-full flex-col">
      <ul className="flex flex-col gap-0.5 px-3 pt-4">
        {items.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : !item.anchor && item.href !== null && pathname.startsWith(item.href);
          const Icon = item.icon;

          if (item.href === null) {
            return (
              <li key={item.label}>
                <span
                  className="flex cursor-not-allowed items-center gap-2.5 whitespace-nowrap rounded-full px-2.5 py-2 text-[12.5px] text-sidebar-muted-foreground"
                  title={item.lockNote}
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white/5">
                    <Icon className="size-[15px]" strokeWidth={1.7} />
                  </span>
                  <span className="flex-1">{item.label}</span>
                  <Lock className="size-3.5 shrink-0" aria-label={item.lockNote} />
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
                  "relative flex items-center gap-2.5 whitespace-nowrap rounded-full px-2.5 py-2 text-[12.5px] transition-colors",
                  active
                    ? "bg-white/[0.07] font-medium text-white ring-1 ring-inset ring-primary/40"
                    : "text-sidebar-foreground/85 hover:bg-white/[0.06]",
                )}
              >
                {active && (
                  <span
                    aria-hidden
                    className="absolute -left-3 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-primary shadow-[0_0_10px_2px_rgba(37,99,235,0.65)]"
                  />
                )}
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full",
                    active ? "bg-primary/25 text-white" : "bg-white/5 text-sidebar-muted-foreground",
                  )}
                >
                  <Icon className="size-[15px]" strokeWidth={1.7} />
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
        <li>
          <a
            href={`mailto:${supportEmail}`}
            className="flex items-center gap-2.5 whitespace-nowrap rounded-full px-2.5 py-2 text-[12.5px] text-sidebar-foreground/85 transition-colors hover:bg-white/[0.06]"
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white/5">
              <Headphones className="size-[15px] text-sidebar-muted-foreground" strokeWidth={1.7} />
            </span>
            Support
          </a>
        </li>
      </ul>

      <div className="mx-5 mt-[22px] border-t border-sidebar-border" />
      <p className="px-5 pb-2.5 pt-5 text-[10.5px] font-bold uppercase tracking-[0.13em] text-sidebar-muted-foreground">
        Coming Soon
      </p>
      <ul className="flex flex-col gap-1 px-3">
        {COMING_SOON.map((item) => (
          <li
            key={item.key}
            className="flex items-center gap-3 whitespace-nowrap px-3 py-[9px] text-[13px] text-sidebar-muted-foreground"
          >
            <Lock className="size-[15px] shrink-0" strokeWidth={1.8} />
            {item.shortTitle ?? item.title}
          </li>
        ))}
      </ul>

      <div className="mt-auto px-5 pt-5">
        <div className="rounded-card border border-sidebar-border bg-sidebar-card p-4">
          <p className="flex items-center gap-2.5 text-[13.5px] font-bold text-sidebar-foreground">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/5">
              <Headphones className="size-4 text-sidebar-foreground" strokeWidth={1.7} />
            </span>
            Need Assistance?
          </p>
          <p className="mt-2 text-[12.5px] text-sidebar-muted-foreground">
            Our team is here to help.
          </p>
          <a
            href={`mailto:${supportEmail}`}
            className="mt-2.5 inline-block text-[12.5px] font-medium text-sidebar-accent hover:text-white"
          >
            Contact Support →
          </a>
        </div>
      </div>
    </nav>
  );
}
