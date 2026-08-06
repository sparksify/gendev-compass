import Link from "next/link";
import { ArrowRight, Check, Clock, Lock, Play, Sparkle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { brand } from "@/lib/config/brand";
import type { PortalState } from "@/types/portal";
import type { JourneySummary } from "@/lib/portal/journey";

/** The command center: where am I, what's next, how long will it take. */
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
    <Card>
      <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-stretch sm:justify-between sm:gap-8 sm:p-7">
        <div className="flex min-w-0 flex-1 gap-4">
          <span
            aria-hidden
            className="flex size-12 shrink-0 items-center justify-center rounded-full border-[1.5px] border-accent-gold bg-[#fbf7ef] text-accent-gold"
          >
            {state.booked ? (
              <Check className="size-5" strokeWidth={2} />
            ) : (
              <Sparkle className="size-5" strokeWidth={1.6} />
            )}
          </span>
          <div className="min-w-0 pt-0.5">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-accent-gold">
              Your Current Step
            </p>
            <p className="mt-1.5 text-[26px] font-bold leading-tight text-foreground">
              {journey.currentMilestoneLabel}
            </p>
            <p className="mt-2.5 max-w-md text-[14px] leading-[1.6] text-muted-foreground">
              {supporting}
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-6">
              <Button asChild size="lg" className="bg-sidebar text-white hover:bg-sidebar/90">
                <Link href={ctaHref}>
                  <Play strokeWidth={1.8} /> {ctaLabel}
                </Link>
              </Button>
              <Button asChild variant="link" className="text-sidebar hover:text-sidebar/80">
                <Link href={`${base}#progress`}>
                  View Full Journey <ArrowRight />
                </Link>
              </Button>
            </div>
          </div>
        </div>

        <dl className="flex shrink-0 flex-col divide-y divide-border pt-0.5 sm:w-[220px] sm:border-l sm:border-border sm:pl-8">
          {journey.timeRemainingMinutes !== null && (
            <div className="pb-4">
              <dt className="flex items-center gap-1.5 whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
                <Clock className="size-3.5 shrink-0 text-faint-foreground" strokeWidth={1.8} />
                Estimated Time Remaining
              </dt>
              <dd className="mt-1.5 whitespace-nowrap text-[26px] font-bold text-sidebar">
                {journey.timeRemainingMinutes} Minutes
              </dd>
            </div>
          )}
          {journey.nextMilestoneLabel && (
            <div className="pt-4">
              <dt className="flex items-center gap-1.5 whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
                <Lock className="size-3.5 shrink-0 text-faint-foreground" strokeWidth={1.8} />
                Next Unlock
              </dt>
              <dd className="mt-1.5 text-[16px] font-bold leading-tight text-foreground">
                {journey.nextMilestoneLabel}
              </dd>
            </div>
          )}
        </dl>
      </div>
    </Card>
  );
}
