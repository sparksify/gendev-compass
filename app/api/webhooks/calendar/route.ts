import { NextResponse } from "next/server";
import { z } from "zod";
import { getStore } from "@/lib/store";
import { autoAdvanceStage } from "@/lib/advisor/stages";
import { ensureLeadDomainChain, type LeadDomainChain } from "@/lib/domain/chain";
import { recordLeadEvent } from "@/lib/domain/activities";
import { syncPrimaryOpportunityActivity } from "@/lib/domain/opportunities";
import { clientIpFrom, rateLimit } from "@/lib/rateLimit";
import type { PortalEventName } from "@/types/analytics";
import type { AppointmentStatus } from "@/types/advisor";

export const dynamic = "force-dynamic";

/**
 * Provider-agnostic calendar webhook (Calendly / HighLevel / Cal.com, …).
 *
 * MISSING INTEGRATION — to activate:
 *   1. Set CALENDAR_WEBHOOK_SECRET (endpoint refuses everything until then).
 *   2. Point the provider's webhook at POST /api/webhooks/calendar with the
 *      secret in the x-webhook-secret header, translating the provider's
 *      payload to the normalized shape below (a thin middleware such as a
 *      provider "custom webhook" template or a small proxy is sufficient).
 *
 * The investor is matched by leadId when the booking embed passed it
 * through, otherwise by invitee email. Unmatched events are rejected — the
 * endpoint never fabricates investor records.
 */
const payloadSchema = z.object({
  action: z.enum(["booked", "rescheduled", "cancelled", "completed", "no_show"]),
  externalAppointmentId: z.string().trim().min(1).max(300),
  leadId: z.string().uuid().optional(),
  inviteeEmail: z.string().trim().email().optional(),
  scheduledStart: z.string().datetime().optional(),
  scheduledEnd: z.string().datetime().optional(),
  timeZone: z.string().trim().max(100).optional(),
  bookingUrl: z.string().trim().url().max(1000).optional(),
  occurredAt: z.string().datetime().optional(),
});

const ACTION_TO_STATUS: Record<string, AppointmentStatus> = {
  booked: "SCHEDULED",
  rescheduled: "RESCHEDULED",
  cancelled: "CANCELLED",
  completed: "COMPLETED",
  no_show: "NO_SHOW",
};

const ACTION_TO_EVENT: Record<string, PortalEventName> = {
  booked: "consultation_booked",
  rescheduled: "consultation_rescheduled",
  cancelled: "consultation_cancelled",
  completed: "consultation_completed",
  no_show: "consultation_no_show",
};

export async function POST(request: Request): Promise<NextResponse> {
  if (!rateLimit(`webhook-calendar:${clientIpFrom(request)}`, 60, 60_000)) {
    return NextResponse.json({ success: false, error: "Too many requests" }, { status: 429 });
  }

  const secret = process.env.CALENDAR_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { success: false, error: "Calendar webhook is not configured (CALENDAR_WEBHOOK_SECRET unset)" },
      { status: 503 },
    );
  }
  if (request.headers.get("x-webhook-secret") !== secret) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid payload", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const payload = parsed.data;

  const store = getStore();
  let lead = payload.leadId
    ? await store.getLeadById(payload.leadId)
    : payload.inviteeEmail
      ? await store.getLeadByEmail(payload.inviteeEmail)
      : null;
  if (!lead) {
    return NextResponse.json(
      { success: false, error: "No matching investor for this appointment" },
      { status: 404 },
    );
  }

  // Resolve the opportunity chain so the appointment lands on the client's
  // journey; failure never blocks the booking (legacy fields still work).
  let chain: LeadDomainChain | null = null;
  try {
    chain = await ensureLeadDomainChain(lead);
    lead = chain.lead;
  } catch (error) {
    console.error(`[webhooks/calendar] chain resolution failed for lead ${lead.id}:`, error);
  }

  try {
    const status = ACTION_TO_STATUS[payload.action];
    const existing = await store.getAppointmentByExternalId(payload.externalAppointmentId);
    const patch = {
      scheduled_start: payload.scheduledStart ?? existing?.scheduled_start ?? null,
      scheduled_end: payload.scheduledEnd ?? existing?.scheduled_end ?? null,
      time_zone: payload.timeZone ?? existing?.time_zone ?? null,
      booking_url: payload.bookingUrl ?? existing?.booking_url ?? null,
      status,
    };

    if (existing) {
      await store.updateAppointment(existing.id, patch);
    } else {
      const advisorProfile = lead.assigned_advisor_id
        ? await store.getProfileByLegacyStaffUserId(lead.assigned_advisor_id)
        : null;
      await store.createAppointment({
        lead_id: lead.id,
        advisor_id: lead.assigned_advisor_id,
        external_appointment_id: payload.externalAppointmentId,
        ...patch,
        organization_id: chain?.organization.id ?? null,
        client_id: chain?.client.id ?? null,
        opportunity_id: chain?.opportunity.id ?? null,
        advisor_profile_id: advisorProfile?.id ?? null,
      });
    }

    const now = new Date().toISOString();
    const updatedLead = await store.updateLead(lead.id, {
      last_activity_at: now,
      ...(payload.action === "booked" && !lead.booked_at
        ? { booked_at: now, appointment_start_at: payload.scheduledStart ?? null }
        : {}),
    });
    await syncPrimaryOpportunityActivity(updatedLead, now);

    await recordLeadEvent(
      updatedLead,
      ACTION_TO_EVENT[payload.action],
      {
        externalAppointmentId: payload.externalAppointmentId,
        scheduledStart: payload.scheduledStart ?? null,
        timeZone: payload.timeZone ?? null,
      },
      null,
      {
        source: "webhook_calendar",
        occurredAt: payload.occurredAt ?? null,
        externalEventId: `calendar:${payload.externalAppointmentId}:${payload.action}:${payload.occurredAt ?? ""}`,
      },
    );

    if (payload.action === "booked" || payload.action === "rescheduled") {
      await autoAdvanceStage(lead, "CONSULTATION_SCHEDULED", "webhook_calendar");
    } else if (payload.action === "completed") {
      await autoAdvanceStage(lead, "CONSULTATION_COMPLETED", "webhook_calendar");
    }

    return NextResponse.json({ success: true, leadId: lead.id });
  } catch (error) {
    console.error("[webhook/calendar] failed:", error);
    return NextResponse.json({ success: false, error: "Webhook processing failed" }, { status: 500 });
  }
}
