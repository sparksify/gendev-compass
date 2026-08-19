import { NextResponse } from "next/server";
import { z } from "zod";
import { getStore } from "@/lib/store";
import { statusRank } from "@/lib/store/types";
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
 * Two accepted request shapes:
 *
 * 1. Native Calendly webhooks — requests carrying a
 *    `Calendly-Webhook-Signature` header. Set CALENDLY_WEBHOOK_SIGNING_KEY
 *    to the signing key Calendly returns when the webhook subscription is
 *    created, and subscribe `invitee.created` + `invitee.canceled` to
 *    POST /api/webhooks/calendar. The payload is verified (HMAC-SHA256)
 *    and translated to the normalized shape below. The investor is matched
 *    by the lead id the booking embed passes as `utm_content`, falling
 *    back to invitee email.
 *
 * 2. Normalized payloads from any other provider/middleware — set
 *    CALENDAR_WEBHOOK_SECRET and send it in the x-webhook-secret header.
 *
 * Unmatched events are rejected — the endpoint never fabricates investor
 * records.
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

// Calendly webhook payload (the subset this endpoint uses). Signature
// header format: "t=<unix ts>,v1=<hex hmac>", HMAC-SHA256 of "<t>.<raw body>"
// with the subscription's signing key.
const calendlyPayloadSchema = z.object({
  event: z.string(),
  created_at: z.string().optional(),
  payload: z.object({
    email: z.string().trim().email().optional(),
    timezone: z.string().max(100).optional(),
    scheduled_event: z
      .object({
        uri: z.string().trim().min(1).max(300),
        start_time: z.string().optional(),
        end_time: z.string().optional(),
      })
      .optional(),
    tracking: z
      .object({ utm_content: z.string().nullable().optional() })
      .nullable()
      .optional(),
  }),
});

const CALENDLY_EVENT_TO_ACTION: Record<string, "booked" | "cancelled"> = {
  "invitee.created": "booked",
  "invitee.canceled": "cancelled",
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function verifyCalendlySignature(
  header: string,
  rawBody: string,
  signingKey: string,
): Promise<boolean> {
  const parts = new Map(
    header.split(",").map((pair) => pair.trim().split("=", 2) as [string, string]),
  );
  const timestamp = parts.get("t");
  const signature = parts.get("v1");
  if (!timestamp || !signature) return false;
  const { createHmac, timingSafeEqual } = await import("node:crypto");
  const expected = createHmac("sha256", signingKey)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
  try {
    return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signature, "hex"));
  } catch {
    return false;
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!rateLimit(`webhook-calendar:${clientIpFrom(request)}`, 60, 60_000)) {
    return NextResponse.json({ success: false, error: "Too many requests" }, { status: 429 });
  }

  const rawBody = await request.text().catch(() => "");
  const calendlySignature = request.headers.get("calendly-webhook-signature");

  let body: unknown = null;

  if (calendlySignature) {
    // Native Calendly delivery — verify and translate.
    const signingKey = process.env.CALENDLY_WEBHOOK_SIGNING_KEY;
    if (!signingKey) {
      return NextResponse.json(
        { success: false, error: "Calendly webhook is not configured (CALENDLY_WEBHOOK_SIGNING_KEY unset)" },
        { status: 503 },
      );
    }
    if (!(await verifyCalendlySignature(calendlySignature, rawBody, signingKey))) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    let calendlyBody: unknown = null;
    try {
      calendlyBody = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
    }
    const calendly = calendlyPayloadSchema.safeParse(calendlyBody);
    if (!calendly.success) {
      return NextResponse.json({ success: false, error: "Invalid payload" }, { status: 400 });
    }

    const action = CALENDLY_EVENT_TO_ACTION[calendly.data.event];
    // Subscriptions may include event types this endpoint doesn't handle —
    // acknowledge them so Calendly doesn't retry.
    if (!action || !calendly.data.payload.scheduled_event) {
      return NextResponse.json({ success: true, ignored: true });
    }

    const utmContent = calendly.data.payload.tracking?.utm_content ?? null;
    body = {
      action,
      externalAppointmentId: calendly.data.payload.scheduled_event.uri,
      leadId: utmContent && UUID_PATTERN.test(utmContent) ? utmContent : undefined,
      inviteeEmail: calendly.data.payload.email,
      scheduledStart: calendly.data.payload.scheduled_event.start_time,
      scheduledEnd: calendly.data.payload.scheduled_event.end_time,
      timeZone: calendly.data.payload.timezone,
      occurredAt: calendly.data.created_at,
    };
  } else {
    // Normalized delivery from a middleware or non-Calendly provider.
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
    try {
      body = JSON.parse(rawBody);
    } catch {
      body = null;
    }
  }

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
        ? {
            booked_at: now,
            appointment_id: payload.externalAppointmentId,
            appointment_start_at: payload.scheduledStart ?? null,
            ...(statusRank(lead.status) < statusRank("booked")
              ? { status: "booked" as const }
              : {}),
          }
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
