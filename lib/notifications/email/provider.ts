/**
 * Provider-agnostic email seam.
 *
 * Business logic (dispatch.ts, rules.ts, templates/) depends only on these
 * types. Swapping Resend for another transactional provider means adding a
 * sibling of resend.ts and changing getEmailProvider() — nothing else.
 */

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  /** Plain-text alternative; improves deliverability and accessibility. */
  text: string;
  /** Lets an advisor reply straight to the investor. */
  replyTo?: string | null;
}

export type EmailSendResult =
  | { ok: true; providerMessageId: string | null }
  | { ok: false; error: string };

export interface EmailProvider {
  /** Stored on the delivery row for debugging. */
  readonly name: string;
  send(message: EmailMessage): Promise<EmailSendResult>;
}

import { notificationsConfigured } from "@/lib/config/env";
import { createResendProvider } from "./resend";

/** Returns the active provider, or null when email is not configured. */
export function getEmailProvider(): EmailProvider | null {
  if (!notificationsConfigured()) return null;
  return createResendProvider();
}
