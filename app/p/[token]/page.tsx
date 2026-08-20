import { StatusCard } from "@/components/dashboard/StatusCard";
import { PathChooser } from "@/components/dashboard/PathChooser";
import { HeroBackdrop } from "@/components/dashboard/HeroBackdrop";
import { VideoCard } from "@/components/dashboard/VideoCard";
import { InvestorFAQ } from "@/components/dashboard/InvestorFAQ";
import { InvalidPortal } from "@/components/portal/InvalidPortal";
import { PortalEventFirer } from "@/components/tracking/PortalEventFirer";
import { loadPortalContext } from "@/lib/portal/context";
import { deriveJourney } from "@/lib/portal/journey";
import { resolveOpportunityProfile } from "@/lib/assets";
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

  const { lead, state, videoProgress, firstVisit } = context;
  const journey = deriveJourney(state);
  const profile = await resolveOpportunityProfile();

  return (
    <div className="space-y-3.5">
      <PortalEventFirer result={context.openEventTracking} />
      <div className="relative overflow-hidden pb-3 pt-5">
        <HeroBackdrop />
        <div className="relative">
          <p className="text-[13px] font-semibold uppercase tracking-[0.03em] text-sidebar">
            {firstVisit ? "Welcome" : "Welcome back"}, {lead.first_name}
          </p>
          <h1 className="mt-1.5 font-serif text-[38px] font-medium leading-[1.08] tracking-[-0.015em] text-sidebar sm:text-[42px]">
            Your {profile.shortName} Investment Journey
          </h1>
          <p className="mt-2 max-w-[760px] text-[15px] leading-[1.55] text-muted-foreground">
            Evaluate this opportunity at your own pace. Everything you share here helps your
            advisor prepare a consultation tailored to your goals and experience.
          </p>
        </div>
      </div>

      <StatusCard token={token} state={state} journey={journey} />

      {!state.videoCompleted && !state.questionnaireCompleted && !state.booked && (
        <PathChooser
          token={token}
          videoStarted={state.videoStarted}
          videoPercent={state.videoPercent}
        />
      )}

      <VideoCard
        token={token}
        state={state}
        videoProgress={videoProgress}
        mediaId={getWistiaMediaId()}
        completionThreshold={getVideoCompletionThreshold()}
        showDevTools={devToolsEnabled()}
        brandLogo={
          profile.logoPath ? { src: profile.logoPath, alt: `${profile.name} logo` } : undefined
        }
      />

      <InvestorFAQ token={token} />
    </div>
  );
}
