import { Card, CardContent } from "@/components/ui/card";
import { StatusCard } from "@/components/dashboard/StatusCard";
import { ProgressTimeline } from "@/components/dashboard/ProgressTimeline";
import { VideoCard } from "@/components/dashboard/VideoCard";
import { Checklist } from "@/components/dashboard/Checklist";
import { OpportunitySnapshot } from "@/components/dashboard/OpportunitySnapshot";
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
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Your Investment Journey
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
          Track your progress through our investor qualification process. Complete each milestone
          to unlock your private consultation and access additional investment materials.
        </p>
      </div>

      <StatusCard token={token} state={state} journey={journey} />

      <Card id="progress">
        <CardContent>
          <ProgressTimeline milestones={journey.milestones} />
        </CardContent>
      </Card>

      <div className="grid gap-8 2xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <VideoCard
          token={token}
          state={state}
          videoProgress={videoProgress}
          mediaId={getWistiaMediaId()}
          completionThreshold={getVideoCompletionThreshold()}
          showDevTools={devToolsEnabled()}
        />
        <Checklist token={token} state={state} />
      </div>

      <OpportunitySnapshot />

      <FAQAccordion />
    </div>
  );
}
