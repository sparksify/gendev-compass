import { getNotificationFromAddress, getResendApiKey } from "@/lib/config/env";
import type { EmailMessage, EmailProvider, EmailSendResult } from "./provider";

/**
 * Resend transactional email, over the REST API.
 *
 * Called with fetch rather than the `resend` SDK to match how every other
 * outbound provider in this codebase is integrated (PostHog in
 * lib/portal/events.ts, GoHighLevel in lib/fdd/ghl.ts) and to avoid adding a
 * dependency for a single POST. Nothing outside this file knows Resend
 * exists.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

/** Bounded so a slow provider cannot hold a prospect's request open. */
const SEND_TIMEOUT_MS = 8000;

export function createResendProvider(): EmailProvider {
  return {
    name: "resend",
    async send(message: EmailMessage): Promise<EmailSendResult> {
      const apiKey = getResendApiKey();
      const from = getNotificationFromAddress();
      if (!apiKey || !from) {
        return { ok: false, error: "Resend is not configured" };
      }

      try {
        const response = await fetch(RESEND_ENDPOINT, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from,
            to: [message.to],
            subject: message.subject,
            html: message.html,
            text: message.text,
            ...(message.replyTo ? { reply_to: [message.replyTo] } : {}),
          }),
          signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
        });

        const body = (await response.json().catch(() => null)) as
          | { id?: string; message?: string; name?: string }
          | null;

        if (!response.ok) {
          // Resend reports the reason in the body; fall back to the status.
          const reason = body?.message ?? body?.name ?? `HTTP ${response.status}`;
          return { ok: false, error: truncate(reason) };
        }

        return { ok: true, providerMessageId: body?.id ?? null };
      } catch (error) {
        const reason = error instanceof Error ? error.message : "Unknown send failure";
        return { ok: false, error: truncate(reason) };
      }
    },
  };
}

/** Keeps a provider error readable in the delivery row. */
function truncate(value: string): string {
  return value.length > 500 ? `${value.slice(0, 497)}...` : value;
}
