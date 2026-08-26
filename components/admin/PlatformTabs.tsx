"use client";

import { HeaderTabs, type HeaderTab } from "@/components/advisor/HeaderTabs";

const TABS: HeaderTab[] = [
  { href: "/advisor/platform", label: "Overview", exact: true },
  { href: "/advisor/platform/fdd", label: "FDD Requests" },
  { href: "/advisor/platform/tracking", label: "Tracking & Pixels" },
  { href: "/advisor/platform/resources", label: "Resources" },
  { href: "/advisor/platform/branding", label: "Branding" },
  { href: "/advisor/platform/users", label: "Users" },
  { href: "/advisor/platform/zip-data", label: "ZIP Data" },
  { href: "/advisor/platform/census-health", label: "Census Health" },
];

/** Portal Admin's section tabs, in the handoff's order. */
export function PlatformTabs() {
  return <HeaderTabs tabs={TABS} />;
}
