import { StatusCard } from "@/components/dashboard/StatusCard";
import { PathChooser } from "@/components/dashboard/PathChooser";
import { HeroBackdrop } from "@/components/dashboard/HeroBackdrop";
import { VideoCard } from "@/components/dashboard/VideoCard";
import { FAQAccordion } from "@/components/dashboard/FAQAccordion";
import { InvalidPortal } from "@/components/portal/InvalidPortal";
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

  const { lead, state, videoProgress } = context;
  const journey = deriveJourney(state);
  const profile = await resolveOpportunityProfile();

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden pb-6 pt-9">
        <HeroBackdrop />
        <div className="relative">
          <p className="text-[14.5px] font-semibold uppercase tracking-[0.03em] text-sidebar">
            Welcome back, {lead.first_name}
          </p>
          <h1 className="mt-2 font-serif text-[48px] font-medium leading-[1.06] tracking-[-0.015em] text-sidebar sm:text-[52px]">
            Your {profile.shortName} Investment Journey
          </h1>
          <p className="mt-3 max-w-[800px] text-[17px] leading-[1.65] text-muted-foreground">
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

      <FAQAccordion />
    </div>
  );
}
