import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { recordLeadEvent } from "@/lib/domain/activities";
import { getGhlConfig } from "@/lib/config/fdd";
import { GhlClient } from "@/lib/ghl/intelligence/client";
import { noteHtml } from "@/lib/ghl/intelligence/project";
import { getZoomMeetingId } from "@/lib/config/zoom";
import type { LeadRecord } from "@/types/lead";

export const dynamic = "force-dynamic";

const ZOOM_TAG = "Registered for Zoom Call";
const ZOOM_WEBHOOK_EVENTS = new Set(["meeting.registration_created", "meeting.registration_approved"]);

function webhookSecret(): string {
  const secret = process.env.ZOOM_WEBHOOK_SECRET_TOKEN;
  if (!secret) throw new Error("ZOOM_WEBHOOK_SECRET_TOKEN is not configured");
  return secret;
}

function validSignature(rawBody: string, request: Request): boolean {
  const timestamp = request.headers.get("x-zm-request-timestamp");
  const signature = request.headers.get("x-zm-signature");
  if (!timestamp || !signature || !signature.startsWith("v0=")) return false;
  const expected = `v0=${createHmac("sha256", webhookSecret()).update(`v0:${timestamp}:${rawBody}`).digest("hex")}`;
  const actualBytes = Buffer.from(signature);
  const expectedBytes = Buffer.from(expected);
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}

type ZoomWebhookBody = {
  event?: string;
  event_ts?: number;
  payload?: {
    plainToken?: string;
    account_id?: string;
    object?: {
      id?: number | string;
      topic?: string;
      occurrences?: Array<{ occurrence_id?: string; start_time?: string }>;
      registrant?: {
        id?: string;
        email?: string;
        first_name?: string;
        last_name?: string;
      };
    };
  };
};

async function upsertHighLevelRegistration(lead: LeadRecord, event: ZoomWebhookBody) {
  const config = getGhlConfig();
  if (!config.apiToken || !config.locationId) {
    console.warn("[zoom] registration received but HighLevel is not configured");
    return;
  }

  const client = new GhlClient();
  const contact = await client.resolveContact(lead);
  const base = `/contacts/${encodeURIComponent(contact.id)}`;
  await client.request(`${base}/tags`, "POST", { tags: [ZOOM_TAG] });

  const marker = `[Compass Zoom registration ${lead.id}]`;
  const notes = (await client.request<{ notes?: Array<{ id: string; body?: string }>}>(`${base}/notes`)).notes ?? [];
  if (!notes.some((note) => note.body?.includes(marker))) {
    const occurrence = event.payload?.object?.occurrences?.[0];
    const detail = occurrence?.start_time ? `Preferred session: ${occurrence.start_time}` : "Recurring Zoom overview registration";
    await client.request(`${base}/notes`, "POST", {
      body: noteHtml(`${marker}\n${detail}\nEmail: ${lead.email}`),
    });
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const rawBody = await request.text();
  let body: ZoomWebhookBody;
  try {
    body = JSON.parse(rawBody) as ZoomWebhookBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.event === "endpoint.url_validation") {
    const plainToken = body.payload?.plainToken;
    if (!plainToken) return NextResponse.json({ error: "Missing validation token" }, { status: 400 });
    return NextResponse.json({
      plainToken,
      encryptedToken: createHmac("sha256", webhookSecret()).update(plainToken).digest("hex"),
    });
  }

  if (!validSignature(rawBody, request)) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  if (!body.event || !ZOOM_WEBHOOK_EVENTS.has(body.event)) return NextResponse.json({ ok: true });

  const registrant = body.payload?.object?.registrant;
  const email = registrant?.email?.trim().toLowerCase();
  if (!registrant || !email) return NextResponse.json({ error: "Missing registrant email" }, { status: 400 });

  const meetingId = String(body.payload?.object?.id ?? "");
  const configuredMeetingId = getZoomMeetingId();
  if (configuredMeetingId && meetingId && meetingId !== configuredMeetingId) return NextResponse.json({ ok: true });

  const lead = await getStore().getLeadByEmail(email);
  if (!lead) {
    console.warn(`[zoom] registration received for unknown email ${email}`);
    return NextResponse.json({ ok: true });
  }

  const externalEventId = `zoom:${body.event}:${meetingId}:${registrant.id ?? email}:${body.event_ts ?? "unknown"}`;
  await upsertHighLevelRegistration(lead, body);
  await getStore().updateLead(lead.id, { last_activity_at: new Date().toISOString() });
  await recordLeadEvent(
    lead,
    body.event === "meeting.registration_approved" ? "zoom_registration_approved" : "zoom_registration_created",
    {
      meetingId,
      registrantId: registrant.id ?? null,
      email,
      firstName: registrant.first_name ?? null,
      lastName: registrant.last_name ?? null,
      occurrences: body.payload?.object?.occurrences ?? [],
    },
    null,
    { source: "webhook_zoom", eventKey: externalEventId, externalEventId, occurredAt: body.event_ts ? new Date(body.event_ts).toISOString() : null },
  );

  return NextResponse.json({ ok: true });
}
