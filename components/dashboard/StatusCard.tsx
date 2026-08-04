import Link from "next/link";
import { ArrowRight, Play } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircleSolid } from "@/components/dashboard/CheckCircleSolid";
import { brand } from "@/lib/config/brand";
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
    supporting = `A few questions about your goals and experience help ${brand.advisorName} prepare a consultation tailored to you. Most investors finish in about 3–5 minutes.`;
    ctaHref = `${base}/questionnaire`;
    ctaLabel = "Begin Qualification";
  } else {
    headline = "Initial Application Received";
    supporting = state.videoStarted
      ? `You're currently reviewing the Investor Overview. ${brand.advisorName} will be ready to tailor your consultation when you are.`
      : `Your next step is the Investor Overview — or begin qualification directly if you're already experienced with franchise investing.`;
    ctaHref = `${base}/overview`;
    ctaLabel = state.videoStarted ? "Resume Investor Overview" : "Begin Investor Overview";
  }

  return (
    <Card>
      <h2 className="px-6 pt-5 text-[15.5px] font-bold text-foreground">Your Current Status</h2>

      <div className="flex flex-col gap-6 px-6 pt-3.5 sm:flex-row sm:items-start sm:gap-7">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-[9px] text-[16.5px] font-bold text-foreground">
            <CheckCircleSolid className="size-[19px] shrink-0" />
            {headline}
          </p>
          <p className="mt-2.5 max-w-md text-[13.5px] leading-[1.6] text-muted-foreground">
            {supporting}
          </p>
        </div>

        <dl className="flex shrink-0 gap-7 pt-0.5">
          {journey.timeRemainingMinutes !== null && (
            <div className="border-r border-border pr-7">
              <dt className="text-xs text-muted-foreground">Estimated time remaining</dt>
              <dd className="mt-1.5 text-[19px] font-bold text-primary">
                {journey.timeRemainingMinutes} Minutes
              </dd>
            </div>
          )}
          <div>
            <dt className="text-xs text-muted-foreground">Progress</dt>
            <dd className="mt-1.5 text-[19px] font-bold text-primary">
              {journey.overallPercent}% Complete
            </dd>
          </div>
        </dl>
      </div>

      <div className="px-6 pt-[18px]">
        <Progress value={journey.overallPercent} aria-label="Journey progress" />
      </div>

      <div className="flex flex-wrap items-center gap-[22px] px-6 pb-[22px] pt-[18px]">
        <Button asChild size="lg">
          <Link href={ctaHref}>
            <Play strokeWidth={1.8} /> {ctaLabel}
          </Link>
        </Button>
        <Button asChild variant="link">
          <Link href={`${base}#progress`}>
            View Full Journey <ArrowRight />
          </Link>
        </Button>
      </div>
    </Card>
  );
}
