import { NextResponse } from "next/server";
import { z } from "zod";
import { requireLead } from "@/lib/portal/api";
import { getStore } from "@/lib/store";
import { statusRank } from "@/lib/store/types";
import { trackEvent } from "@/lib/portal/events";
import { autoAdvanceStage } from "@/lib/advisor/stages";

export const dynamic = "force-dynamic";

const bookingSchema = z.object({
  appointmentId: z.string().trim().max(300).optional(),
  appointmentStartAt: z.string().datetime().optional(),
  /** 'embed-event' when detected from the calendar widget, 'manual-confirm' for the fallback button. */
  detectedVia: z.enum(["embed-event", "manual-confirm"]).default("manual-confirm"),
});

/**
 * Marks the lead as booked. Scheduling opens as soon as the questionnaire
 * is submitted — the advisor reviews responses before the call, so there is
 * no approval gate. Booking is still not a path around the questionnaire.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  const { token } = await params;
  const resolved = await requireLead(token);
  if ("response" in resolved) return resolved.response;
  const { lead } = resolved;

  const questionnaireCompleted =
    Boolean(lead.questionnaire_completed_at) || Boolean(await getStore().getQuestionnaire(lead.id));
  if (!questionnaireCompleted) {
    return NextResponse.json(
      { success: false, error: "Please complete the questionnaire before scheduling." },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const parsed = bookingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid payload" }, { status: 400 });
  }

  const now = new Date().toISOString();

  try {
    if (!lead.booked_at) {
      const store = getStore();
      await store.updateLead(lead.id, {
        booked_at: now,
        appointment_id: parsed.data.appointmentId ?? null,
        appointment_start_at: parsed.data.appointmentStartAt ?? null,
        last_activity_at: now,
        ...(statusRank(lead.status) < statusRank("booked") ? { status: "booked" as const } : {}),
      });

      // Advisor-backend appointment record. The assigned advisor (when set)
      // is carried onto the appointment; the provider webhook can enrich or
      // supersede this record via the external appointment ID.
      await store.createAppointment({
        lead_id: lead.id,
        advisor_id: lead.assigned_advisor_id,
        external_appointment_id: parsed.data.appointmentId ?? null,
        scheduled_start: parsed.data.appointmentStartAt ?? null,
        status: "SCHEDULED",
      });
      await autoAdvanceStage(lead, "CONSULTATION_SCHEDULED", "portal");

      await trackEvent(lead, "calendar_booking_completed", {
        detectedVia: parsed.data.detectedVia,
      });
      await trackEvent(lead, "portal_completed", null);
    }

    // The schedule page renders the booked confirmation state in place.
    return NextResponse.json({ success: true, nextUrl: `/p/${token}/schedule` });
  } catch (error) {
    console.error("[booking] failed:", error);
    return NextResponse.json(
      { success: false, error: "Booking could not be recorded. Please try again." },
      { status: 500 },
    );
  }
}
