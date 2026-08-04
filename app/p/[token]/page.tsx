import { StatusCard } from "@/components/dashboard/StatusCard";
import { ProgressTimeline } from "@/components/dashboard/ProgressTimeline";
import { VideoCard } from "@/components/dashboard/VideoCard";
import { Checklist } from "@/components/dashboard/Checklist";
import { FAQAccordion } from "@/components/dashboard/FAQAccordion";
import { InvalidPortal } from "@/components/portal/InvalidPortal";
import { loadPortalContext } from "@/lib/portal/context";
import { deriveJourney } from "@/lib/portal/journey";
import { devToolsEnabled, getWistiaMediaId } from "@/lib/config/env";
import { getVideoCompletionThreshold } from "@/lib/config/qualification";

export const dynamic = "force-dynamic";

/** The Investment Journey dashboard — the portal's home. */
export default async function PortalDashboardPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const context = await loadPortalContext(token);
  if (!context) return <InvalidPortal />;

  const { state, videoProgress } = context;
  const journey = deriveJourney(state);

  return (
    <div className="space-y-[18px]">
      <div>
        <h1 className="font-serif text-4xl font-normal leading-[1.1] tracking-[-0.01em] text-foreground sm:text-[42px]">
          Your Investment Journey
        </h1>
        <p className="mt-3 max-w-[380px] text-[13.5px] leading-[1.65] text-muted-foreground">
          Track your progress through our investor qualification process. Complete each milestone
          to unlock your private consultation and access additional investment materials.
        </p>
      </div>

      <StatusCard token={token} state={state} journey={journey} />

      <section id="progress" className="overflow-x-auto px-1 pb-0.5 pt-1.5">
        <ProgressTimeline milestones={journey.milestones} />
      </section>

      <div className="grid gap-[18px] lg:grid-cols-[1.62fr_1fr]">
        <VideoCard
          token={token}
          state={state}
          videoProgress={videoProgress}
          mediaId={getWistiaMediaId()}
          completionThreshold={getVideoCompletionThreshold()}
          showDevTools={devToolsEnabled()}
        />
        <Checklist state={state} />
      </div>

      <FAQAccordion />
    </div>
  );
}
