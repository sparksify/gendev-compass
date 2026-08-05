import { redirect } from "next/navigation";
import { CalendarCheck2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { AppointmentDetails } from "@/components/portal/AppointmentDetails";
import { InvalidPortal } from "@/components/portal/InvalidPortal";
import { FddRequestCard, type FddSnapshot } from "@/components/dashboard/FddRequestCard";
import { loadPortalContext } from "@/lib/portal/context";
import { effectiveFddStatus } from "@/lib/fdd/status";
import { brand } from "@/lib/config/brand";
import type { LeadRecord } from "@/types/lead";

function fddSnapshot(lead: LeadRecord): FddSnapshot {
  return {
    status: effectiveFddStatus(lead),
    requestedAt: lead.fdd_requested_at,
    receivedAt: lead.fdd_received_at,
    eligibleAt: lead.fdd_eligible_at,
  };
}

export const dynamic = "force-dynamic";

/**
 * Terminal page for both outcomes: booked prospects see their confirmation,
 * review-required prospects see a respectful holding message.
 */
export default async function CompletePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const context = await loadPortalContext(token);
  if (!context) return <InvalidPortal />;

  const { lead, state } = context;

  if (!state.booked && !state.reviewRequired) {
    redirect(`/p/${token}`);
  }

  if (state.reviewRequired) {
    return (
      <div className="max-w-xl space-y-6">
        <h1 className="font-serif text-4xl font-normal leading-[1.1] tracking-[-0.01em] text-foreground sm:text-[42px]">
          Your Investor Profile Has Been Submitted
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Thank you for reviewing the investor overview and submitting your information.
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Our team will review your responses and determine the appropriate next step. You may
          also request the Franchise Disclosure Document now to continue your evaluation.
        </p>

        {state.questionnaireCompleted && (
          <FddRequestCard
            token={token}
            initial={fddSnapshot(lead)}
            timeZone={brand.timeZone}
            advisorName={brand.advisorName}
          />
        )}

        <p className="text-sm text-muted-foreground">
          Questions in the meantime?{" "}
          <a className="text-primary hover:underline" href={`mailto:${brand.supportEmail}`}>
            {brand.supportEmail}
          </a>
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="flex items-center gap-3 font-serif text-4xl font-normal leading-[1.1] tracking-[-0.01em] text-foreground sm:text-[42px]">
        <CalendarCheck2 className="size-7 text-success" />
        Your Consultation Is Scheduled
      </h1>
      <p className="text-sm leading-relaxed text-muted-foreground">Thank you, {lead.first_name}.</p>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Your consultation with {brand.advisorName} has been scheduled. Please add the appointment
        to your calendar and arrive prepared to discuss your investment goals, available capital,
        timeline, and remaining questions.
      </p>

      <Card>
        <CardContent>
          <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Appointment Details
          </h2>
          {lead.appointment_start_at ? (
            <AppointmentDetails startAt={lead.appointment_start_at} />
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              Your booking is confirmed. A calendar invitation with the exact date and time has
              been sent to {lead.email}.
            </p>
          )}
        </CardContent>
      </Card>

      {state.questionnaireCompleted && (
        <FddRequestCard
          token={token}
          initial={fddSnapshot(lead)}
          timeZone={brand.timeZone}
          advisorName={brand.advisorName}
        />
      )}

      <p className="text-sm text-muted-foreground">
        Need to reschedule? Use the link in your confirmation email or contact{" "}
        <a className="text-primary hover:underline" href={`mailto:${brand.supportEmail}`}>
          {brand.supportEmail}
        </a>
        .
      </p>
    </div>
  );
}
