import Image from "next/image";
import { Bell, ChevronDown } from "lucide-react";
import { brand } from "@/lib/config/brand";

interface TopNavigationProps {
  firstName: string;
  lastName: string;
}

/** Fixed portal header: brand, portal label, notifications, advisor, avatar. */
export function TopNavigation({ firstName, lastName }: TopNavigationProps) {
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || "IN";

  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-border bg-card">
      <div className="flex h-16 items-center">
        {/* Brand block sized to sit above the left rail. */}
        <div className="flex h-full items-center gap-3 border-border px-4 sm:px-6 lg:w-60 lg:border-r xl:w-64">
          <Image src={brand.logoPath} alt={brand.brandName} width={30} height={30} priority />
          <div className="hidden sm:block">
            <p className="font-serif text-[15px] font-semibold uppercase leading-tight tracking-[0.14em] text-foreground">
              {brand.brandName}
            </p>
            <p className="text-[10px] font-medium uppercase leading-tight tracking-[0.22em] text-muted-foreground">
              {brand.productName.replace(`${brand.brandName} `, "")}
            </p>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 items-center gap-6 px-4 sm:px-8">
          <p className="hidden truncate text-base font-medium text-foreground md:block">
            {brand.portalLabel}
          </p>

          <div className="ml-auto flex items-center gap-5">
            <span className="relative inline-flex text-muted-foreground" aria-label="Notifications">
              <Bell className="size-5" strokeWidth={1.75} />
              <span
                className="absolute -right-1 -top-1 size-2.5 rounded-full border-2 border-card bg-primary"
                aria-hidden
              />
            </span>
            <p className="hidden text-sm text-muted-foreground sm:block">
              Advisor: <span className="font-medium text-primary">{brand.advisorName}</span>
            </p>
            <span className="flex items-center gap-1.5">
              <span
                aria-label={`Signed in as ${firstName} ${lastName}`}
                className="flex size-9 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary"
              >
                {initials}
              </span>
              <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
