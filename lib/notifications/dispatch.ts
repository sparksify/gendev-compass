import { getStore } from "@/lib/store";
import { notificationsConfigured } from "@/lib/config/env";
import { buildDedupeKey, resolveNotificationRule } from "@/lib/notifications/rules";
import { resolveAdvisorRecipient } from "@/lib/notifications/recipients";
import { getEmailProvider } from "@/lib/notifications/email/provider";
import { buildEmailBody } from "@/lib/notifications/templates";
import type { LeadRecord } from "@/types/lead";

/**
 * Stage three of the pipeline: an event has been recorded, now decide
 * whether a human hears about it and record what happened.
 *
 *   USER ACTION -> ACTIVITY EVENT -> [ this module ] -> DELIVERY RECORD
 *
 * Two invariants hold no matter what:
 *
 *  1. This never throws. Notification is a side effect of an investor's
 *     action, never a precondition for it — a questionnaire submission must
 *     succeed even if Resend is down, misconfigured, or slow.
 *  2. One real-world action produces at most one email. The dedupe key is
 *     claimed in the database *before* the send, so a retried request or a
 *     second delivery path loses the race and returns quietly.
 */

export interface DispatchInput {
  lead: LeadRecord;
  eventName: string;
  eventData: Record<string, unknown> | null;
  /** The activity_events row, when the lead's domain chain exists. */
  activityEventId?: string | null;
}

export async function dispatchNotificationsForEvent(input: DispatchInput): Promise<void> {
  try {
    await dispatch(input);
  } catch (error) {
    // Last line of defence — nothing above this may surface to the investor.
    console.error(`[notifications] dispatch failed for ${input.eventName}:`, error);
  }
}

async function dispatch({
  lead,
  eventName,
  eventData,
  activityEventId = null,
}: DispatchInput): Promise<void> {
  const rule = resolveNotificationRule(eventName);
  if (!rule || rule.action !== "immediate_email") return;

  // Checked before the dedupe key is claimed: an unconfigured environment
  // has not attempted anything, and must not burn the key that a correctly
  // configured deployment would need later.
  if (!notificationsConfigured()) {
    console.warn(
      `[notifications] ${eventName} is set to email but RESEND_API_KEY / NOTIFICATION_FROM_EMAIL are unset — skipping.`,
    );
    return;
  }

  const store = getStore();
  const resolved = await resolveAdvisorRecipient(lead);
  // Rule-level fixed recipients (e.g. every completed questionnaire also
  // goes to the founder inbox). Deduped against the resolved advisor; when
  // no advisor resolves at all the first CC becomes the primary recipient
  // so the notification is never lost.
  const ccPool = (rule.ccEmails ?? []).filter(
    (email) => email.toLowerCase() !== resolved?.email.toLowerCase(),
  );
  const recipient =
    resolved ??
    (ccPool.length > 0 ? { email: ccPool[0], name: null, source: "default" as const } : null);
  const cc = ccPool.filter((email) => email.toLowerCase() !== recipient?.email.toLowerCase());
  const dedupeKey = buildDedupeKey(lead.id, rule, eventData);

  // Claiming the key is the atomic gate. A duplicate returns null and stops
  // here, before any provider call.
  const delivery = await store.createNotificationDelivery({
    organization_id: lead.organization_id,
    lead_id: lead.id,
    activity_event_id: activityEventId,
    event_type: eventName,
    channel: rule.channel,
    template_key: rule.templateKey,
    recipient: recipient?.email ?? null,
    dedupe_key: dedupeKey,
    status: "pending",
  });

  if (!delivery) return; // already notified for this action

  if (!recipient) {
    await fail(
      delivery.id,
      "No recipient: the investor has no active assigned advisor and DEFAULT_ADVISOR_NOTIFICATION_EMAIL is unset.",
    );
    return;
  }

  const provider = getEmailProvider();
  if (!provider) {
    await fail(delivery.id, "Email provider is not configured.");
    return;
  }

  const body = await buildEmailBody(rule.templateKey, { lead, eventData });
  if (!body) {
    await fail(delivery.id, `No template registered for "${rule.templateKey}".`);
    return;
  }

  const result = await provider.send({
    to: recipient.email,
    ...(cc.length > 0 ? { cc } : {}),
    subject: body.subject,
    html: body.html,
    text: body.text,
    // Replying to the alert reaches the investor directly.
    replyTo: lead.email,
    ...(body.attachments && body.attachments.length > 0
      ? { attachments: body.attachments }
      : {}),
  });

  if (!result.ok) {
    await fail(delivery.id, result.error, provider.name);
    console.error(
      `[notifications] ${eventName} email to ${recipient.email} failed: ${result.error}`,
    );
    return;
  }

  await store
    .updateNotificationDelivery(delivery.id, {
      status: "sent",
      provider: provider.name,
      provider_message_id: result.providerMessageId,
      sent_at: new Date().toISOString(),
    })
    .catch((error) => {
      // The mail is already out; losing the bookkeeping must not throw.
      console.error(`[notifications] could not mark delivery ${delivery.id} sent:`, error);
    });
}

async function fail(id: string, message: string, provider?: string): Promise<void> {
  await getStore()
    .updateNotificationDelivery(id, {
      status: "failed",
      error_message: message,
      ...(provider ? { provider } : {}),
    })
    .catch((error) => {
      console.error(`[notifications] could not mark delivery ${id} failed:`, error);
    });
}
