import Image from "next/image";
import { TopNavigation } from "@/components/layout/TopNavigation";
import { SidebarNavigation } from "@/components/layout/SidebarNavigation";
import { RightSidebar } from "@/components/layout/RightSidebar";
import { brand } from "@/lib/config/brand";
import type { PortalContext } from "@/lib/portal/context";

/** Wordmark block shown at the top of the sidebar (and in the header on mobile). */
export function BrandBlock() {
  return (
    <div className="flex items-center gap-2.5">
      <Image src={brand.logoPath} alt={brand.brandName} width={24} height={24} priority />
      <div className="leading-none">
        <p className="whitespace-nowrap font-serif text-[13px] font-semibold uppercase tracking-[0.06em] text-foreground">
          {brand.productName}
        </p>
        <p className="mt-0.5 whitespace-nowrap text-[8px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          {brand.tagline}
        </p>
      </div>
    </div>
  );
}

interface PortalShellProps {
  context: PortalContext;
  token: string;
  children: React.ReactNode;
}

/**
 * Portal app frame (comp: GenDev_Compass_Investor_Portal.html): 236px white
 * left rail carrying the wordmark, 59px header in the main column, center
 * content and 376px right sidebar on the gray canvas. Sidebars collapse
 * below the content on smaller viewports.
 */
export function PortalShell({ context, token, children }: PortalShellProps) {
  const { lead, state } = context;

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-[236px] shrink-0 flex-col border-r border-border bg-card lg:flex">
        <div className="flex h-[59px] shrink-0 items-center border-b border-border px-5">
          <BrandBlock />
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-5">
          <SidebarNavigation
            token={token}
            supportEmail={brand.supportEmail}
            consultationAvailable={state.qualified || state.booked}
          />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <TopNavigation firstName={lead.first_name} lastName={lead.last_name} />

        <div className="flex-1 px-4 pb-8 pt-[26px] sm:px-7">
          <div className="mx-auto flex max-w-[1360px] items-start gap-6">
            <main className="min-w-0 flex-1">{children}</main>

            <aside className="hidden w-[376px] shrink-0 xl:block">
              <RightSidebar token={token} state={state} />
            </aside>
          </div>

          <footer className="mx-auto mt-16 max-w-[1360px] border-t border-border pt-6">
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-muted-foreground">
              <a href={brand.privacyPolicyUrl} className="hover:text-foreground hover:underline">
                Privacy Policy
              </a>
              <a href={brand.termsUrl} className="hover:text-foreground hover:underline">
                Terms
              </a>
            </div>
            <div className="mt-5 max-w-4xl">
              <h2 className="text-[13px] font-bold text-foreground">{brand.legalNoticeTitle}</h2>
              <div className="mt-2.5 space-y-2.5">
                {brand.legalNotice.map((paragraph, index) => (
                  <p key={index} className="text-xs leading-relaxed text-muted-foreground">
                    {paragraph}
                  </p>
                ))}
              </div>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              © {new Date().getFullYear()} {brand.brandName}. All rights reserved.
            </p>
          </footer>
        </div>
      </div>
    </div>
  );
}
