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
 * Portal app frame (spec: Layout): fixed full-width header, full-height
 * white left rail flush with the viewport edge, center content and right
 * sidebar on the gray canvas. Sidebars collapse below the content on
 * smaller viewports.
 */
export function PortalShell({ context, token, children }: PortalShellProps) {
  const { lead, state } = context;
  const journey = deriveJourney(state);

  return (
    <div className="min-h-screen">
      <TopNavigation firstName={lead.first_name} lastName={lead.last_name} />

      <div className="flex pt-16">
        <aside className="hidden w-60 shrink-0 border-r border-border bg-card lg:block xl:w-64">
          <div className="sticky top-16 flex h-[calc(100vh-4rem)] flex-col overflow-y-auto px-4 py-6">
            <SidebarNavigation
              token={token}
              firstName={lead.first_name}
              supportEmail={brand.supportEmail}
              consultationAvailable={state.qualified || state.booked}
            />
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <div className="mx-auto max-w-[1220px] px-4 py-8 sm:px-8">
            <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_330px]">
              <main className="min-w-0">{children}</main>

              <aside className="xl:block">
                <RightSidebar token={token} state={state} journey={journey} />
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
                <a
                  href={`mailto:${brand.supportEmail}`}
                  className="hover:text-foreground hover:underline"
                >
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
      </div>
    </div>
  );
}
