import { loadPortalContext } from "@/lib/portal/context";
import { PortalShell } from "@/components/layout/PortalShell";
import { InvalidPortal } from "@/components/portal/InvalidPortal";

/**
 * Portal chrome: validates the token and wraps every portal page in the
 * three-column shell. Pages load their own context for gating — this layout
 * only reads (trackOpen: false) so open-tracking happens exactly once.
 */
export default async function PortalLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const context = await loadPortalContext(token, { trackOpen: false });

  if (!context) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <InvalidPortal />
      </div>
    );
  }

  return (
    <PortalShell context={context} token={token}>
      {children}
    </PortalShell>
  );
}
