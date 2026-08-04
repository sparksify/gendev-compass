import { Bell, ChevronDown } from "lucide-react";
import { BrandBlock } from "@/components/layout/PortalShell";
import { brand } from "@/lib/config/brand";

interface TopNavigationProps {
  firstName: string;
  lastName: string;
}

/** 59px portal header: portal label, notifications, advisor, avatar (comp). */
export function TopNavigation({ firstName, lastName }: TopNavigationProps) {
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || "IN";

  return (
    <header className="sticky top-0 z-40 flex h-[59px] shrink-0 items-center justify-between border-b border-border bg-card px-4 sm:px-7">
      <div className="lg:hidden">
        <BrandBlock />
      </div>
      <p className="hidden text-[15px] font-medium text-secondary-foreground lg:block">
        {brand.portalLabel}
      </p>

      <div className="flex items-center gap-5">
        <span className="relative inline-flex text-secondary-foreground" aria-label="Notifications">
          <Bell className="size-[19px]" strokeWidth={1.7} />
          <span
            className="absolute -right-1 -top-1 size-2.5 rounded-full border-2 border-card bg-primary"
            aria-hidden
          />
        </span>
        <p className="hidden text-[13.5px] text-secondary-foreground sm:block">
          Advisor: <span className="font-medium text-primary">{brand.advisorName}</span>
        </p>
        <span className="flex items-center gap-2">
          <span
            aria-label={`Signed in as ${firstName} ${lastName}`}
            className="flex size-[34px] items-center justify-center rounded-full bg-primary-soft text-[13px] font-semibold text-primary"
          >
            {initials}
          </span>
          <ChevronDown className="size-3.5 text-muted-foreground" strokeWidth={2} aria-hidden />
        </span>
      </div>
    </header>
  );
}
