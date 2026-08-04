import { TopNavigation } from "@/components/layout/TopNavigation";
import { SidebarNavigation } from "@/components/layout/SidebarNavigation";
import { RightSidebar } from "@/components/layout/RightSidebar";
import { brand } from "@/lib/config/brand";
import { deriveJourney } from "@/lib/portal/journey";
import type { PortalContext } from "@/lib/portal/context";

interface PortalShellProps {
  context: PortalContext;
  token: string;
  children: React.ReactNode;
}

/**
 * Three-column portal layout (spec: Layout): fixed header, sticky left
 * navigation, center content, sticky right sidebar, max width 1500px.
 * Sidebars collapse below the content on smaller viewports.
 */
export function PortalShell({ context, token, children }: PortalShellProps) {
  const { lead, state } = context;
  const journey = deriveJourney(state);

  return (
    <div className="min-h-screen">
      <TopNavigation firstName={lead.first_name} lastName={lead.last_name} />

      <div className="mx-auto max-w-[1500px] px-4 pb-16 pt-24 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[230px_minmax(0,1fr)_330px]">
          <aside className="hidden lg:block">
            <div className="sticky top-24">
              <SidebarNavigation
                token={token}
                firstName={lead.first_name}
                supportEmail={brand.supportEmail}
                consultationAvailable={state.qualified || state.booked}
              />
            </div>
          </aside>

          <main className="min-w-0">{children}</main>

          <aside className="xl:block">
            <div className="sticky top-24">
              <RightSidebar token={token} state={state} journey={journey} />
            </div>
          </aside>
        </div>

        <footer className="mt-16 border-t border-border pt-6">
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <a href={brand.privacyPolicyUrl} className="hover:text-foreground hover:underline">
              Privacy Policy
            </a>
            <a href={brand.termsUrl} className="hover:text-foreground hover:underline">
              Terms
            </a>
            <a href={`mailto:${brand.supportEmail}`} className="hover:text-foreground hover:underline">
              {brand.supportEmail}
            </a>
          </div>
          <p className="mt-4 max-w-3xl text-xs leading-relaxed text-muted-foreground">
            {brand.legalDisclaimer}
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            © {new Date().getFullYear()} {brand.brandName}. All rights reserved.
          </p>
        </footer>
      </div>
    </div>
  );
}
