import { ResourceLibrary } from "@/components/resources/ResourceLibrary";
import { InvalidPortal } from "@/components/portal/InvalidPortal";
import { loadPortalContext } from "@/lib/portal/context";
import { trackEvent } from "@/lib/portal/events";
import { listResources } from "@/lib/resources";

export const dynamic = "force-dynamic";

/**
 * Resources: an admin-managed, growable list of files and links —
 * previously an anchor-scroll into the Opportunity page's fixed Documents
 * section (presentation/one-sheet, which stays there unchanged), now its
 * own destination the sidebar navigates to directly.
 */
export default async function ResourcesPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const context = await loadPortalContext(token);
  if (!context) return <InvalidPortal />;

  const resources = await listResources();
  await trackEvent(context.lead, "resources_opened", { count: resources.length }, "resources");

  return (
    <div className="space-y-[18px]">
      <div>
        <h1 className="font-serif text-[32px] font-normal leading-[1.1] tracking-[-0.01em] text-foreground sm:text-[38px]">
          Resources
        </h1>
        <p className="mt-2.5 max-w-[38rem] text-[13.5px] leading-[1.65] text-muted-foreground">
          Guides, documents, and links your advisor has shared to help with your evaluation.
        </p>
      </div>

      <ResourceLibrary resources={resources} />
    </div>
  );
}
