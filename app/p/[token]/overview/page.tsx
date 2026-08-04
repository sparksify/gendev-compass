import Link from "next/link";
import { ArrowRight, CheckCircle2, Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { VideoCard } from "@/components/dashboard/VideoCard";
import { InvalidPortal } from "@/components/portal/InvalidPortal";
import { loadPortalContext } from "@/lib/portal/context";
import { brand } from "@/lib/config/brand";
import { devToolsEnabled, getWistiaMediaId } from "@/lib/config/env";
import { getVideoCompletionThreshold } from "@/lib/config/qualification";
import { trackEvent } from "@/lib/portal/events";

export const dynamic = "force-dynamic";

/**
 * The Investor Overview. Remains accessible at every stage so prospects can
 * rewatch; forward progress is gated elsewhere (questionnaire, schedule).
 */
export default async function OverviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const context = await loadPortalContext(token);
  if (!context) return <InvalidPortal />;

  const { lead, state, videoProgress } = context;

  if (!state.videoCompleted) {
    await trackEvent(lead, "overview_page_opened", null, "overview");
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Investor Overview</h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
          {lead.first_name}, this overview explains the opportunity, how the model works, who it is
          designed for, and what to expect during your consultation.
        </p>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
          Please watch the complete overview before continuing. This allows your conversation with{" "}
          {brand.advisorName} to focus on your specific situation rather than information covered
          in the presentation.
        </p>
      </div>

      <VideoCard
        token={token}
        state={state}
        videoProgress={videoProgress}
        mediaId={getWistiaMediaId()}
        completionThreshold={getVideoCompletionThreshold()}
        showDevTools={devToolsEnabled()}
      />

      {state.videoCompleted ? (
        <Card>
          <CardContent className="space-y-3">
            <p className="flex items-center gap-2 text-base font-semibold text-foreground">
              <CheckCircle2 className="size-5 text-success" /> Investor Overview Completed
            </p>
            {!state.questionnaireCompleted ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Your qualification questionnaire is now available.
                </p>
                <Button asChild size="lg">
                  <Link href={`/p/${token}/questionnaire`}>
                    Continue to Qualification <ArrowRight />
                  </Link>
                </Button>
              </>
            ) : (
              <Button asChild variant="secondary">
                <Link href={`/p/${token}`}>
                  Back to Your Journey <ArrowRight />
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="space-y-2">
            <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Lock className="size-4 text-muted-foreground" /> Qualification Questionnaire
            </p>
            <p className="text-sm text-muted-foreground">
              Unlocks once you&apos;ve watched the investor overview.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
