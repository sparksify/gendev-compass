import { redirect } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarEmbed } from "@/components/portal/CalendarEmbed";
import { BookingConfirmation } from "@/components/portal/BookingConfirmation";
import { FddCard } from "@/components/portal/FddCard";
import { NextStepsTimeline } from "@/components/portal/NextStepsTimeline";
import { AdvisorCard } from "@/components/cards/AdvisorCard";
import { InvalidPortal } from "@/components/portal/InvalidPortal";
import { loadPortalContext } from "@/lib/portal/context";
import { fddSnapshot } from "@/lib/fdd/status";
import { brand } from "@/lib/config/brand";
import { getCalendarEmbedUrl } from "@/lib/config/env";
import { getAdvisorPhotoUrl } from "@/lib/assets";
import { getStore } from "@/lib/store";
import { statusRank } from "@/lib/store/types";
import { trackEvent } from "@/lib/portal/events";

export const dynamic = "force-dynamic";

/**
 * The post-questionnaire page: scheduling is the immediate next step for
 * every prospect who has submitted their investor profile — the advisor
 * reviews the responses before the call, so there is no approval gate.
 *
 * States: calendar (not yet booked) → booking confirmation (booked), with
 * the FDD card and the "What Happens Next" timeline alongside. On xl
 * screens the advisor and FDD cards live in the shell's right sidebar;
 * below xl they render inline after the calendar.
 */
export default async function SchedulePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const context = await loadPortalContext(token);
  if (!context) return <InvalidPortal />;

  const { lead, state } = context;

  // The only requirement is a submitted questionnaire.
  if (!state.questionnaireCompleted && !state.booked) {
    redirect(state.videoCompleted ? `/p/${token}/questionnaire` : `/p/${token}/overview`);
  }

  if (!state.booked && !lead.calendar_viewed_at) {
    await getStore().updateLead(lead.id, {
      calendar_viewed_at: new Date().toISOString(),
      ...(statusRank(lead.status) < statusRank("calendar_viewed")
        ? { status: "calendar_viewed" as const }
        : {}),
    });
    await trackEvent(lead, "calendar_opened", null, "schedule");
  }

  const advisorPhotoUrl = await getAdvisorPhotoUrl();

  return (
    <div className="space-y-7">
      <p className="flex items-center gap-2 text-[13px] font-medium text-foreground">
        <CheckCircle2 className="size-[17px] shrink-0 text-success" strokeWidth={2.2} />
        Investor Profile Submitted
        <span className="hidden font-normal text-muted-foreground sm:inline">
          — Your responses have been received and shared with your advisor.
        </span>
      </p>

      {state.booked ? (
        <BookingConfirmation
          advisorName={brand.advisorName}
          advisorEmail={brand.advisorEmail}
          startAt={lead.appointment_start_at}
          email={lead.email}
        />
      ) : (
        <>
          <div>
            <h1 className="font-serif text-4xl font-normal leading-[1.1] tracking-[-0.01em] text-foreground sm:text-[42px]">
              You&apos;re Ready to Meet Your Advisor
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
              Thanks, {lead.first_name}. Your investor profile gives your advisor the context
              needed to prepare for a focused, productive conversation.
            </p>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
              Choose a convenient time below to discuss your goals, ask questions, and evaluate
              whether this opportunity is a strong mutual fit.
            </p>
          </div>

          <section aria-labelledby="schedule-heading">
            <Card>
              <CardContent className="p-6">
                <h2 id="schedule-heading" className="text-[15.5px] font-bold text-foreground">
                  Schedule Your Consultation
                </h2>
                <p className="mt-2 max-w-xl text-[13px] leading-[1.6] text-muted-foreground">
                  Select a time that works best for you. Your advisor will review your
                  questionnaire before the meeting so the conversation can focus on your
                  priorities.
                </p>
                <div className="mt-5">
                  <CalendarEmbed
                    embedUrl={getCalendarEmbedUrl()}
                    token={token}
                    prefill={{
                      firstName: lead.first_name,
                      lastName: lead.last_name,
                      email: lead.email,
                      phone: lead.phone,
                      leadId: lead.id,
                    }}
                    advisorName={brand.advisorName}
                    advisorPhone={brand.advisorPhone}
                    advisorEmail={brand.advisorEmail}
                  />
                </div>
              </CardContent>
            </Card>
          </section>
        </>
      )}

      {/* Below xl the shell's right sidebar is hidden — surface the advisor
          and FDD cards inline, in the spec's mobile order. */}
      <div className="space-y-[18px] xl:hidden">
        <AdvisorCard token={token} state={state} photoUrl={advisorPhotoUrl ?? undefined} />
        <FddCard
          token={token}
          email={lead.email}
          initial={fddSnapshot(lead)}
          timeZone={brand.timeZone}
          advisorName={brand.advisorName}
        />
      </div>

      <NextStepsTimeline booked={state.booked} fddAcknowledged={state.fddAcknowledged} />
    </div>
  );
}
