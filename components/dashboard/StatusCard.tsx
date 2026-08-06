import Link from "next/link";
import { ArrowRight, Check, Clock, Compass, Lock, Play } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProgressTimeline } from "@/components/dashboard/ProgressTimeline";
import { brand } from "@/lib/config/brand";
import type { PortalState } from "@/types/portal";
import type { JourneySummary } from "@/lib/portal/journey";

/** The command center: where am I, what's next, how long will it take —
 * with the journey stepper built into the card's own bottom section. */
export function StatusCard({
  token,
  state,
  journey,
}: {
  token: string;
  state: PortalState;
  journey: JourneySummary;
}) {
  const base = `/p/${token}`;

  let supporting: string;
  let ctaHref: string;
  let ctaLabel: string;

  if (state.booked) {
    supporting = "Your consultation is booked. Review your confirmation and prepare your questions.";
    ctaHref = `${base}/schedule`;
    ctaLabel = "View Consultation Details";
  } else if (state.questionnaireCompleted) {
    supporting = `Your investor profile has been shared with ${brand.advisorName}. Choose a convenient time to discuss your goals and evaluate whether this opportunity is a strong mutual fit.`;
    ctaHref = `${base}/schedule`;
    ctaLabel = "Schedule Consultation";
  } else if (state.videoCompleted) {
    supporting = `A few questions about your goals and experience help ${brand.advisorName} prepare a consultation tailored to you. Most investors finish in about 3–5 minutes.`;
    ctaHref = `${base}/questionnaire`;
    ctaLabel = "Begin Qualification";
  } else {
    supporting = `Learn about the business model, investment requirements, and what it means to own a ${brand.brandName} business.`;
    ctaHref = `${base}/overview`;
    ctaLabel = state.videoStarted ? "Resume Investor Overview" : "Begin Investor Overview";
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-5 px-6 pb-2 pt-5 sm:flex-row sm:items-stretch sm:justify-between sm:gap-8 sm:px-9 sm:pb-2 sm:pt-6">
        <div className="flex min-w-0 flex-[3] gap-4">
          <span
            aria-hidden
            className="flex size-14 shrink-0 items-center justify-center rounded-full border border-accent-gold bg-[#fbf7ef] text-sidebar"
          >
            {state.booked ? (
              <Check className="size-5" strokeWidth={1.8} />
            ) : (
              <Compass className="size-6" strokeWidth={1.4} />
            )}
          </span>
          <div className="min-w-0 pt-0.5">
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-accent-gold">
              Your Current Step
            </p>
            <p className="mt-1 font-serif text-[28px] font-medium leading-[1.08] text-sidebar sm:text-[30px]">
              {journey.currentMilestoneLabel}
            </p>
            <p className="mt-1.5 max-w-[600px] text-[14px] leading-[1.5] text-muted-foreground">
              {supporting}
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-6">
              <Button
                asChild
                className="h-[46px] rounded-[7px] bg-sidebar px-5 text-[14px] shadow-[0_1px_2px_rgb(16_24_40/0.08)] hover:bg-sidebar/90"
              >
                <Link href={ctaHref}>
                  <Play className="size-4" strokeWidth={1.8} /> {ctaLabel}
                </Link>
              </Button>
              <Button
                asChild
                variant="link"
                className="text-[14px] text-sidebar hover:text-sidebar/80"
              >
                <Link href={`${base}#progress`}>
                  View Full Journey <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>

        <dl className="flex shrink-0 flex-col divide-y divide-border pt-0.5 sm:w-[220px] sm:flex-1 sm:border-l sm:border-border sm:pl-8">
          {journey.timeRemainingMinutes !== null && (
            <div className="pb-3">
              <dt className="flex items-center gap-1.5 whitespace-nowrap text-[11.5px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
                <Clock className="size-3.5 shrink-0 text-faint-foreground" strokeWidth={1.8} />
                Estimated Time Remaining
              </dt>
              <dd className="mt-1.5 whitespace-nowrap font-serif text-[28px] font-medium leading-tight text-sidebar sm:text-[30px]">
                {journey.timeRemainingMinutes} Minutes
              </dd>
            </div>
          )}
          {journey.nextMilestoneLabel && (
            <div className="pt-3">
              <dt className="flex items-center gap-1.5 whitespace-nowrap text-[11.5px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
                <Lock className="size-3.5 shrink-0 text-faint-foreground" strokeWidth={1.8} />
                Next Unlock
              </dt>
              <dd className="mt-1.5 font-serif text-[21px] font-medium leading-[1.15] text-sidebar">
                {journey.nextMilestoneLabel}
              </dd>
            </div>
          )}
        </dl>
      </div>

      <div id="progress" className="overflow-x-auto border-t border-border px-6 pb-3.5 pt-0.5 sm:px-8">
        <ProgressTimeline milestones={journey.milestones} />
      </div>
    </Card>
  );
}
