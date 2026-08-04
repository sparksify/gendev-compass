import Image from "next/image";
import { Bell } from "lucide-react";
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
      <div className="mx-auto flex h-16 max-w-[1500px] items-center gap-6 px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <Image src={brand.logoPath} alt={brand.brandName} width={32} height={32} priority />
          <div className="hidden sm:block">
            <p className="text-sm font-semibold leading-tight text-foreground">{brand.brandName}</p>
            <p className="text-[11px] uppercase tracking-wide leading-tight text-muted-foreground">
              {brand.productName}
            </p>
          </div>
        </div>

        <div className="hidden h-6 w-px bg-border md:block" aria-hidden />
        <p className="hidden text-sm font-medium text-foreground md:block">{brand.portalLabel}</p>

        <div className="ml-auto flex items-center gap-4">
          <span className="relative inline-flex text-muted-foreground" aria-label="Notifications">
            <Bell className="size-5" />
            <span
              className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-primary"
              aria-hidden
            />
          </span>
          <p className="hidden text-sm text-muted-foreground sm:block">
            Advisor: <span className="font-medium text-primary">{brand.advisorName}</span>
          </p>
          <span
            aria-label={`Signed in as ${firstName} ${lastName}`}
            className="flex size-9 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary"
          >
            {initials}
          </span>
        </div>
      </div>
    </header>
  );
}
