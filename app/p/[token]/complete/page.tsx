import { redirect } from "next/navigation";
import { loadPortalContext } from "@/lib/portal/context";
import { InvalidPortal } from "@/components/portal/InvalidPortal";
import { AppointmentDetails } from "@/components/portal/AppointmentDetails";
import { brand } from "@/lib/config/brand";

export const dynamic = "force-dynamic";

/**
 * Terminal page for both outcomes: booked prospects see their confirmation,
 * review-required prospects see a respectful holding message (spec §15, §17).
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
      <div className="mx-auto max-w-xl space-y-6 py-8">
        <h1 className="text-2xl font-semibold text-ink sm:text-3xl">
          Thank You for Completing the Process
        </h1>
        <p className="text-sm leading-relaxed text-ink-muted">
          Thank you for reviewing the investor overview and submitting your information.
        </p>
        <p className="text-sm leading-relaxed text-ink-muted">
          Our team will review your responses and determine the most appropriate next step. If
          additional information is needed, someone from our team will contact you directly.
        </p>
        <p className="text-sm text-ink-muted">
          Questions in the meantime?{" "}
          <a className="underline" href={`mailto:${brand.supportEmail}`}>
            {brand.supportEmail}
          </a>
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-6 py-8">
      <h1 className="text-2xl font-semibold text-ink sm:text-3xl">
        Your Consultation Is Scheduled
      </h1>
      <p className="text-sm leading-relaxed text-ink-muted">Thank you, {lead.first_name}.</p>
      <p className="text-sm leading-relaxed text-ink-muted">
        Your consultation with {brand.advisorName} has been scheduled. Please add the appointment to
        your calendar and arrive prepared to discuss your investment goals, available capital,
        timeline, and remaining questions.
      </p>

      <div className="rounded-xl border border-line bg-white p-5">
        <h2 className="text-xs font-medium uppercase tracking-wide text-ink-muted">
          Appointment Details
        </h2>
        {lead.appointment_start_at ? (
          <AppointmentDetails startAt={lead.appointment_start_at} />
        ) : (
          <p className="mt-3 text-sm text-ink-muted">
            Your booking is confirmed. A calendar invitation with the exact date and time has been
            sent to {lead.email}.
          </p>
        )}
      </div>

      <p className="text-sm text-ink-muted">
        Need to reschedule? Use the link in your confirmation email or contact{" "}
        <a className="underline" href={`mailto:${brand.supportEmail}`}>
          {brand.supportEmail}
        </a>
        .
      </p>
    </div>
  );
}
