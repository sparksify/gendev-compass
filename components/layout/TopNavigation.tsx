import { BrandBlock } from "@/components/layout/PortalShell";
import { MobileMenu } from "@/components/layout/MobileMenu";
import { brand } from "@/lib/config/brand";

interface TopNavigationProps {
  firstName: string;
  lastName: string;
  siteLogoUrl?: string;
  token: string;
  consultationAvailable: boolean;
}

/**
 * 59px portal header. Desktop: portal label, advisor, prospect initials.
 * Mobile: brand lockup and a hamburger menu carrying the sidebar navigation.
 * There is no sign-in/out — access is via the personal magic link — so the
 * header holds no authentication or notification controls.
 */
export function TopNavigation({
  firstName,
  lastName,
  siteLogoUrl,
  token,
  consultationAvailable,
}: TopNavigationProps) {
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || "IN";

  return (
    <header className="sticky top-0 z-40 flex h-[59px] shrink-0 items-center justify-between border-b border-border bg-card px-4 sm:px-7">
      <div className="lg:hidden">
        <BrandBlock logoUrl={siteLogoUrl} />
      </div>
      <p className="hidden text-[15px] font-medium text-secondary-foreground lg:block">
        {brand.portalLabel}
      </p>

      <div className="flex items-center gap-5">
        <p className="hidden text-[13.5px] text-secondary-foreground lg:block">
          Advisor: <span className="font-medium text-primary">{brand.advisorName}</span>
        </p>
        <span
          aria-label={`Portal for ${firstName} ${lastName}`}
          className="hidden size-[34px] items-center justify-center rounded-full bg-primary-soft text-[13px] font-semibold text-primary lg:flex"
        >
          {initials}
        </span>
        <MobileMenu
          token={token}
          supportEmail={brand.supportEmail}
          consultationAvailable={consultationAvailable}
        />
      </div>
    </header>
  );
}
