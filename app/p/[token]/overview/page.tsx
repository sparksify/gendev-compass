import Link from "next/link";
import { redirect } from "next/navigation";
import { loadPortalContext } from "@/lib/portal/context";
import { InvalidPortal } from "@/components/portal/InvalidPortal";
import { PortalProgress } from "@/components/portal/PortalProgress";
import { WistiaPlayer } from "@/components/portal/WistiaPlayer";
import { DevToolsPanel } from "@/components/portal/DevToolsPanel";
import { brand } from "@/lib/config/brand";
import { devToolsEnabled, getWistiaMediaId } from "@/lib/config/env";
import { getVideoCompletionThreshold } from "@/lib/config/qualification";
import { trackEvent } from "@/lib/portal/events";

export const dynamic = "force-dynamic";

export default async function OverviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const context = await loadPortalContext(token);
  if (!context) return <InvalidPortal />;

  const { lead, state, videoProgress } = context;

  if (state.booked || state.reviewRequired) redirect(`/p/${token}/complete`);
  if (state.qualified) redirect(`/p/${token}/schedule`);

  if (!state.videoCompleted) {
    await trackEvent(lead, "overview_page_opened", null, "overview");
  }

  const mediaId = getWistiaMediaId();
  const threshold = getVideoCompletionThreshold();

  return (
    <div className="space-y-8">
      <PortalProgress items={state.checklist} />

      <div>
        <h1 className="text-2xl font-semibold text-ink sm:text-3xl">Investor Overview</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-muted">
          {lead.first_name}, this overview explains the opportunity, how the model works, who it is
          designed for, and what to expect during your consultation.
        </p>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-muted">
          Please watch the complete overview before continuing. This allows your conversation with{" "}
          {brand.advisorName} to focus on your specific situation rather than information covered in
          the presentation.
        </p>
      </div>

      <WistiaPlayer
        mediaId={mediaId}
        token={token}
        initialPercent={state.videoPercent}
        initialCompleted={state.videoCompleted}
        resumePosition={videoProgress?.last_playhead_position ?? 0}
        completionThreshold={threshold}
      />

      {state.videoCompleted ? (
        <div className="rounded-xl border border-line bg-white p-6">
          <p className="text-base font-semibold text-ink">Investor Overview Completed</p>
          <p className="mt-2 text-sm text-ink-muted">
            Your qualification questionnaire is now available.
          </p>
          <Link
            href={`/p/${token}/questionnaire`}
            className="mt-4 inline-block rounded-lg bg-brand px-6 py-3 text-sm font-semibold text-white hover:opacity-90"
          >
            Continue to Qualification
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border border-line bg-white p-6">
          <div className="flex items-center gap-3">
            <span aria-hidden className="text-lg">🔒</span>
            <p className="text-sm font-semibold text-ink">Qualification Questionnaire</p>
          </div>
          <p className="mt-2 text-sm text-ink-muted">
            Unlocks once you&apos;ve watched the investor overview.
          </p>
        </div>
      )}

      <p className="text-sm text-ink-muted">
        Having trouble with the video?{" "}
        <a className="underline" href={`mailto:${brand.supportEmail}`}>
          Contact our team
        </a>
        .
      </p>

      {devToolsEnabled() && <DevToolsPanel token={token} />}
    </div>
  );
}
