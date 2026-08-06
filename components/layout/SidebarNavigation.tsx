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
                  className="flex cursor-not-allowed items-center gap-3 rounded-control border border-transparent px-3 py-[11px] text-[13px] text-sidebar-muted-foreground"
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
                    ? "border-transparent bg-primary font-medium text-primary-foreground"
                    : "border-transparent text-sidebar-foreground/85 hover:bg-white/[0.06]",
                )}
              >
                <Icon
                  className={cn(
                    "size-[17px] shrink-0",
                    active ? "text-primary-foreground" : "text-sidebar-muted-foreground",
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
            className="flex items-center gap-3 rounded-control border border-transparent px-3 py-[11px] text-[13px] text-sidebar-foreground/85 transition-colors hover:bg-white/[0.06]"
          >
            <Headphones className="size-[17px] shrink-0 text-sidebar-muted-foreground" strokeWidth={1.7} />
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
          <p className="flex items-center gap-2 text-[13.5px] font-bold text-sidebar-foreground">
            <Headphones className="size-4 text-sidebar-foreground" strokeWidth={1.7} />
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
