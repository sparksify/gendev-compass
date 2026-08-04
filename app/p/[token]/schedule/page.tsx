import { redirect } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarEmbed } from "@/components/portal/CalendarEmbed";
import { InvalidPortal } from "@/components/portal/InvalidPortal";
import { loadPortalContext } from "@/lib/portal/context";
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
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Your Consultation Is Ready to Schedule
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
          You have completed the investor overview and qualification process.
        </p>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
          Select a time below to speak with {brand.advisorName}. Your questionnaire responses will
          be reviewed before the call so the conversation can focus on your specific goals and
          questions.
        </p>
      </div>

      <Card>
        <CardContent>
          <ul className="space-y-2 text-sm text-foreground">
            {[
              "Investor Overview Completed",
              "Qualification Questionnaire Completed",
              "Consultation Approved",
            ].map((item) => (
              <li key={item} className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-success" /> {item}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

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
