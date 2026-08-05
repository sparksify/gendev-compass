import { NextResponse } from "next/server";
import { z } from "zod";
import { getStore } from "@/lib/store";
import { autoAdvanceStage } from "@/lib/advisor/stages";
import { clientIpFrom, rateLimit } from "@/lib/rateLimit";
import type { PortalEventName } from "@/types/analytics";
import type { FddStatus } from "@/types/advisor";

export const dynamic = "force-dynamic";

/**
 * FDD document-provider webhook (e-delivery / e-signature platform).
 *
 * MISSING INTEGRATION — to activate:
 *   1. Set FDD_WEBHOOK_SECRET (endpoint refuses everything until then).
 *   2. Point the provider's event notifications at POST /api/webhooks/fdd
 *      with the secret in the x-webhook-secret header, mapped to the
 *      normalized payload below.
 *
 * The provider is the source of truth for delivery and acknowledgment; this
 * endpoint records exactly what the provider reports and never fabricates
 * status. No legal eligibility dates are computed anywhere.
 */
const payloadSchema = z.object({
  action: z.enum(["sent", "delivered", "opened", "acknowledged", "delivery_failed", "resent"]),
  leadId: z.string().uuid().optional(),
  recipientEmail: z.string().trim().email().optional(),
  documentVersion: z.string().trim().max(200).optional(),
  providerTransactionId: z.string().trim().max(300).optional(),
  auditCertificateUrl: z.string().trim().url().max(1000).optional(),
  timeZone: z.string().trim().max(100).optional(),
  occurredAt: z.string().datetime().optional(),
});

const ACTION_TO_STATUS: Record<string, FddStatus> = {
  sent: "SENT",
  delivered: "DELIVERED",
  opened: "OPENED",
  acknowledged: "ACKNOWLEDGED",
  delivery_failed: "DELIVERY_FAILED",
  resent: "RESENT",
};

const ACTION_TO_EVENT: Record<string, PortalEventName> = {
  sent: "fdd_sent",
  delivered: "fdd_delivered",
  opened: "fdd_opened",
  acknowledged: "fdd_acknowledged",
  delivery_failed: "fdd_delivery_failed",
  resent: "fdd_sent",
};

/** Forward-only status ordering; a late "delivered" never undoes "acknowledged". */
const STATUS_ORDER: FddStatus[] = [
  "NOT_REQUESTED",
  "REQUESTED",
  "SENT",
  "RESENT",
  "DELIVERY_FAILED",
  "DELIVERED",
  "OPENED",
  "ACKNOWLEDGED",
];

export async function POST(request: Request): Promise<NextResponse> {
  if (!rateLimit(`webhook-fdd:${clientIpFrom(request)}`, 60, 60_000)) {
    return NextResponse.json({ success: false, error: "Too many requests" }, { status: 429 });
  }

  const secret = process.env.FDD_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { success: false, error: "FDD webhook is not configured (FDD_WEBHOOK_SECRET unset)" },
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
  const lead = payload.leadId
    ? await store.getLeadById(payload.leadId)
    : payload.recipientEmail
      ? await store.getLeadByEmail(payload.recipientEmail)
      : null;
  if (!lead) {
    return NextResponse.json(
      { success: false, error: "No matching investor for this FDD event" },
      { status: 404 },
    );
  }

  try {
    const now = new Date().toISOString();
    const occurredAt = payload.occurredAt ?? now;
    const newStatus = ACTION_TO_STATUS[payload.action];
    const existing = await store.getFddRecordForLead(lead.id);
    const currentStatus = existing?.status ?? "NOT_REQUESTED";

    // Failure and resend always record; other statuses only move forward.
    const statusAdvances =
      newStatus === "DELIVERY_FAILED" ||
      newStatus === "RESENT" ||
      STATUS_ORDER.indexOf(newStatus) > STATUS_ORDER.indexOf(currentStatus);

    await store.upsertFddRecord(lead.id, {
      ...(statusAdvances ? { status: newStatus } : {}),
      document_version: payload.documentVersion ?? existing?.document_version ?? null,
      provider_transaction_id:
        payload.providerTransactionId ?? existing?.provider_transaction_id ?? null,
      audit_certificate_url: payload.auditCertificateUrl ?? existing?.audit_certificate_url ?? null,
      destination_email: payload.recipientEmail ?? existing?.destination_email ?? lead.email,
      ...(payload.action === "sent" || payload.action === "resent"
        ? { sent_at: existing?.sent_at ?? occurredAt }
        : {}),
      ...(payload.action === "delivered" ? { delivered_at: occurredAt } : {}),
      ...(payload.action === "opened" ? { opened_at: existing?.opened_at ?? occurredAt } : {}),
      ...(payload.action === "acknowledged"
        ? {
            acknowledged_at: occurredAt,
            acknowledgment_time_zone: payload.timeZone ?? null,
          }
        : {}),
    });

    await store.insertEvent(
      lead.id,
      ACTION_TO_EVENT[payload.action],
      {
        action: payload.action,
        documentVersion: payload.documentVersion ?? null,
        providerTransactionId: payload.providerTransactionId ?? null,
      },
      null,
      { source: "webhook_fdd", occurredAt: payload.occurredAt ?? null },
    );

    await store.updateLead(lead.id, {
      last_activity_at: now,
      ...(payload.action === "acknowledged" ? { fdd_acknowledged_at: occurredAt } : {}),
    });

    if (payload.action === "sent" || payload.action === "resent") {
      await autoAdvanceStage(lead, "FDD_SENT", "webhook_fdd");
    } else if (payload.action === "acknowledged") {
      await autoAdvanceStage(lead, "FDD_ACKNOWLEDGED", "webhook_fdd");
    }

    return NextResponse.json({ success: true, leadId: lead.id });
  } catch (error) {
    console.error("[webhook/fdd] failed:", error);
    return NextResponse.json({ success: false, error: "Webhook processing failed" }, { status: 500 });
  }
}
