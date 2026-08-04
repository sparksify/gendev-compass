import Link from "next/link";
import { ArrowRight, CheckCircle2, Play } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { PortalState } from "@/types/portal";
import type { JourneySummary } from "@/lib/portal/journey";

interface StatusCardProps {
  token: string;
  state: PortalState;
  journey: JourneySummary;
}

/** The command center: where am I, what's next, how long will it take. */
export function StatusCard({ token, state, journey }: StatusCardProps) {
  const base = `/p/${token}`;

  let headline: string;
  let supporting: string;
  let ctaHref: string;
  let ctaLabel: string;

  if (state.booked) {
    headline = "Consultation Scheduled";
    supporting = "Your consultation is booked. Review your confirmation and prepare your questions.";
    ctaHref = `${base}/complete`;
    ctaLabel = "View Consultation Details";
  } else if (state.reviewRequired) {
    headline = "Application Under Review";
    supporting =
      "Thank you for completing the process. Our team is reviewing your responses and will contact you directly with next steps.";
    ctaHref = `${base}/complete`;
    ctaLabel = "View Status";
  } else if (state.qualified) {
    headline = "Consultation Approved";
    supporting = "You're qualified. Select a time that works for you to speak with your advisor.";
    ctaHref = `${base}/schedule`;
    ctaLabel = "Schedule Consultation";
  } else if (state.videoCompleted) {
    headline = "Investor Overview Completed";
    supporting =
      "Your qualification questionnaire is now available. It takes about 15 minutes to complete.";
    ctaHref = `${base}/questionnaire`;
    ctaLabel = "Start Questionnaire";
  } else {
    headline = "Initial Application Received";
    supporting = state.videoStarted
      ? "You're currently reviewing the Investor Overview. Complete this step to unlock your private consultation."
      : "Your next step is the Investor Overview. Complete it to unlock your private consultation.";
    ctaHref = `${base}/overview`;
    ctaLabel = state.videoStarted ? "Resume Investor Overview" : "Begin Investor Overview";
  }

  return (
    <Card>
      <CardContent className="space-y-5 p-6 sm:p-7">
        <h2 className="text-base font-semibold text-foreground">Your Current Status</h2>

        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-md">
            <p className="flex items-center gap-2.5 text-lg font-semibold text-foreground">
              <CheckCircle2 className="size-5 shrink-0 text-success" />
              {headline}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{supporting}</p>
          </div>

          <dl className="flex shrink-0 divide-x divide-border">
            {journey.timeRemainingMinutes !== null && (
              <div className="pr-8">
                <dt className="text-xs text-muted-foreground">Estimated time remaining</dt>
                <dd className="mt-1.5 text-xl font-semibold tracking-tight text-foreground">
                  {journey.timeRemainingMinutes} Minutes
                </dd>
              </div>
            )}
            <div className="pl-8 first:pl-0">
              <dt className="text-xs text-muted-foreground">Progress</dt>
              <dd className="mt-1.5 text-xl font-semibold tracking-tight text-primary">
                {journey.overallPercent}% Complete
              </dd>
            </div>
          </dl>
        </div>

        <Progress value={journey.overallPercent} aria-label="Journey progress" />

        <div className="flex flex-wrap items-center gap-5 pt-1">
          <Button asChild size="lg">
            <Link href={ctaHref}>
              <Play className="fill-current" /> {ctaLabel}
            </Link>
          </Button>
          <Button asChild variant="link">
            <Link href={`${base}#progress`}>
              View Full Journey <ArrowRight />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
