import Link from "next/link";
import { ArrowRight, Check, Clock, Lock, Play, Star } from "lucide-react";
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
      <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-start sm:justify-between sm:gap-7">
        <div className="flex min-w-0 flex-1 gap-4">
          <span
            aria-hidden
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
          >
            {state.booked ? (
              <Check className="size-5" strokeWidth={2.2} />
            ) : (
              <Star className="size-5 fill-current" strokeWidth={1.8} />
            )}
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-primary">
              Your Current Step
            </p>
            <p className="mt-1 text-[19px] font-bold leading-tight text-foreground">
              {journey.currentMilestoneLabel}
            </p>
            <p className="mt-2 max-w-md text-[13.5px] leading-[1.6] text-muted-foreground">
              {supporting}
            </p>
          </div>
        </div>

        <dl className="flex shrink-0 flex-col gap-3.5 pt-0.5">
          {journey.timeRemainingMinutes !== null && (
            <div>
              <dt className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.04em] text-muted-foreground">
                <Clock className="size-3.5 text-faint-foreground" strokeWidth={1.8} />
                Estimated Time Remaining
              </dt>
              <dd className="mt-1 text-[19px] font-bold text-primary">
                {journey.timeRemainingMinutes} Minutes
              </dd>
            </div>
          )}
          {journey.nextMilestoneLabel && (
            <div>
              <dt className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.04em] text-muted-foreground">
                <Lock className="size-3.5 text-faint-foreground" strokeWidth={1.8} />
                Next Unlock
              </dt>
              <dd className="mt-1 max-w-[10rem] text-[15px] font-bold leading-tight text-foreground">
                {journey.nextMilestoneLabel}
              </dd>
            </div>
          )}
        </dl>
      </div>

      <div className="flex flex-wrap items-center gap-[22px] px-6 pb-[22px] pt-1">
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
