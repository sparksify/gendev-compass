import { StatusCard } from "@/components/dashboard/StatusCard";
import { PathChooser } from "@/components/dashboard/PathChooser";
import { ProgressTimeline } from "@/components/dashboard/ProgressTimeline";
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
    <div className="space-y-[18px]">
      <div>
        <p className="text-[13.5px] text-muted-foreground">Welcome back, {lead.first_name}</p>
        <h1 className="mt-1 font-serif text-4xl font-normal leading-[1.1] tracking-[-0.01em] text-foreground sm:text-[42px]">
          Your {profile.shortName} Investment Journey
        </h1>
        <p className="mt-3 max-w-[38rem] text-[13.5px] leading-[1.65] text-muted-foreground">
          Evaluate this opportunity at your own pace. Everything you share here helps your advisor
          prepare a consultation tailored to your goals and experience.
        </p>
      </div>

      {!state.videoCompleted &&
      !state.questionnaireCompleted &&
      !state.qualified &&
      !state.reviewRequired &&
      !state.booked ? (
        <PathChooser
          token={token}
          videoStarted={state.videoStarted}
          videoPercent={state.videoPercent}
        />
      ) : (
        <StatusCard token={token} state={state} journey={journey} />
      )}

      <section id="progress" className="overflow-x-auto px-1 pb-0.5 pt-1.5">
        <ProgressTimeline milestones={journey.milestones} />
      </section>

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
