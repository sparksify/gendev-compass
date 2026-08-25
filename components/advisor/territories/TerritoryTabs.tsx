"use client";

import { HeaderTabs, type HeaderTab } from "@/components/advisor/HeaderTabs";

/** The Territory Advisor's section tabs, in the handoff's order. */
export function TerritoryTabs({ pendingReviews }: { pendingReviews: number }) {
  const tabs: HeaderTab[] = [
    { href: "/advisor/territories/records", label: "Records" },
    { href: "/advisor/territories/eligibility", label: "State Eligibility" },
    { href: "/advisor/territories/map", label: "Map" },
    { href: "/advisor/territories/searches", label: "Searches" },
    { href: "/advisor/territories/reviews", label: "Review Queue", badge: pendingReviews },
    { href: "/advisor/territories/settings", label: "Settings" },
  ];
  return <HeaderTabs tabs={tabs} />;
}
