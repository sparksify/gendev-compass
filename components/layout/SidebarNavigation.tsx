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
    { label: "Investor FAQ", href: `${base}/faq`, icon: HelpCircle },
    { label: "Resources", href: `${base}/resources`, icon: FolderOpen },
    {
      label: "My Consultation",
      href: consultationAvailable ? `${base}/schedule` : null,
      icon: CalendarDays,
      lockNote: "Available after your questionnaire",
    },
  ];

  return (
    <nav aria-label="Portal navigation" className="flex min-h-full flex-col">
      <ul className="flex flex-col gap-1.5 px-3 pt-4">
        {items.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : !item.anchor && item.href !== null && pathname.startsWith(item.href);
          const Icon = item.icon;

          if (item.href === null) {
            return (
              <li key={item.label}>
                <span
                  className="sidebar-row flex cursor-not-allowed items-center gap-2.5 whitespace-nowrap border border-transparent px-2.5 py-2.5 text-[12.5px] text-sidebar-muted-foreground/55"
                  title={item.lockNote}
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full text-sidebar-muted-foreground/45">
                    <Icon className="size-[15px]" strokeWidth={1.7} />
                  </span>
                  <span className="flex-1">{item.label}</span>
                  <Lock className="size-3.5 shrink-0 text-sidebar-muted-foreground/45" aria-label={item.lockNote} />
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
                  "sidebar-row group relative flex items-center gap-2.5 whitespace-nowrap border border-transparent px-2.5 py-2.5 text-[12.5px]",
                  active
                    ? "sidebar-row-active font-medium text-sidebar-foreground"
                    : "text-sidebar-muted-foreground/72 hover:bg-white/[0.03] hover:text-sidebar-foreground/90",
                )}
              >
                {active && (
                  <span
                    aria-hidden
                    className="sidebar-indicator absolute -left-[10px] top-1/2 h-[55%] w-[3px] -translate-y-1/2 rounded-full"
                  />
                )}
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full border border-transparent transition-colors duration-200",
                    active
                      ? "sidebar-icon-active text-white"
                      : "text-sidebar-muted-foreground/60 group-hover:bg-white/[0.04] group-hover:text-sidebar-foreground/85",
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
            className="sidebar-row group flex items-center gap-2.5 whitespace-nowrap border border-transparent px-2.5 py-2.5 text-[12.5px] text-sidebar-muted-foreground/72 hover:bg-white/[0.03] hover:text-sidebar-foreground/90"
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full text-sidebar-muted-foreground/60 transition-colors duration-200 group-hover:bg-white/[0.04] group-hover:text-sidebar-foreground/85">
              <Headphones className="size-[15px]" strokeWidth={1.7} />
            </span>
            Support
          </a>
        </li>
      </ul>

      <div className="mx-5 mt-[22px] border-t border-sidebar-border" />
      <p className="px-5 pb-2.5 pt-5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-sidebar-muted-foreground/55">
        Unlocks Later
      </p>
      <ul className="flex flex-col gap-1 px-3">
        {COMING_SOON.map((item) => (
          <li
            key={item.key}
            className="flex items-center gap-3 whitespace-nowrap px-3 py-[9px] text-[13px] text-sidebar-muted-foreground/55"
          >
            <Lock className="size-[15px] shrink-0" strokeWidth={1.8} />
            {item.shortTitle ?? item.title}
          </li>
        ))}
      </ul>

      <div className="mt-auto px-5 pt-5">
        <div className="sidebar-support-card rounded-card border p-4">
          <p className="flex items-center gap-2.5 text-[13.5px] font-bold text-sidebar-foreground">
            <span className="sidebar-support-icon flex size-8 shrink-0 items-center justify-center rounded-full border">
              <Headphones className="size-4 text-white" strokeWidth={1.7} />
            </span>
            Need Assistance?
          </p>
          <p className="mt-2 text-[12.5px] text-sidebar-muted-foreground/70">
            Our team is here to help.
          </p>
          <a
            href={`mailto:${supportEmail}`}
            className="mt-2.5 inline-block text-[12.5px] font-medium text-sidebar-accent transition-colors duration-200 hover:text-white"
          >
            Contact Support →
          </a>
        </div>
      </div>
    </nav>
  );
}
