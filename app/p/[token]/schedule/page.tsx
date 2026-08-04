import { redirect } from "next/navigation";
import { loadPortalContext } from "@/lib/portal/context";
import { InvalidPortal } from "@/components/portal/InvalidPortal";
import { PortalProgress } from "@/components/portal/PortalProgress";
import { CalendarEmbed } from "@/components/portal/CalendarEmbed";
import { AdvisorCard } from "@/components/portal/AdvisorCard";
import { brand } from "@/lib/config/brand";
import { getCalendarEmbedUrl } from "@/lib/config/env";
import { getStore } from "@/lib/store";
import { statusRank } from "@/lib/store/types";
import { trackEvent } from "@/lib/portal/events";

export const dynamic = "force-dynamic";

export default async function SchedulePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const context = await loadPortalContext(token);
  if (!context) return <InvalidPortal />;

  const { lead, state } = context;

  // Calendar access is gated server-side: only qualified prospects get here.
  if (state.booked) redirect(`/p/${token}/complete`);
  if (state.reviewRequired) redirect(`/p/${token}/complete`);
  if (!state.qualified) {
    redirect(state.videoCompleted ? `/p/${token}/questionnaire` : `/p/${token}/overview`);
  }

  if (!lead.calendar_viewed_at) {
    await getStore().updateLead(lead.id, {
      calendar_viewed_at: new Date().toISOString(),
      ...(statusRank(lead.status) < statusRank("calendar_viewed")
        ? { status: "calendar_viewed" as const }
        : {}),
    });
    await trackEvent(lead, "calendar_opened", null, "schedule");
  }

  return (
    <div className="space-y-8">
      <PortalProgress items={state.checklist} />

      <div>
        <h1 className="text-2xl font-semibold text-ink sm:text-3xl">
          Your Consultation Is Ready to Schedule
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-muted">
          You have completed the investor overview and qualification process.
        </p>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-muted">
          Select a time below to speak with {brand.advisorName}. Your questionnaire responses will
          be reviewed before the call so the conversation can focus on your specific goals and
          questions.
        </p>
      </div>

      <ul className="space-y-2 rounded-xl border border-line bg-white p-5 text-sm text-ink">
        <li>✓ Investor Overview Completed</li>
        <li>✓ Qualification Questionnaire Completed</li>
        <li>✓ Consultation Approved</li>
      </ul>

      <AdvisorCard />

      <CalendarEmbed
        embedUrl={getCalendarEmbedUrl()}
        token={token}
        prefill={{
          name: `${lead.first_name} ${lead.last_name}`.trim(),
          email: lead.email,
          phone: lead.phone,
          leadId: lead.id,
        }}
        supportEmail={brand.supportEmail}
      />
    </div>
  );
}
