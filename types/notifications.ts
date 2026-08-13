/**
 * Advisor notification layer.
 *
 * Activity is already recorded centrally (lib/domain/activities.ts writes
 * portal_events + activity_events). This module covers the second half of
 * the pipeline: which recorded events are important enough to reach a human,
 * and what happened when we tried to tell them.
 *
 *   USER ACTION -> ACTIVITY EVENT -> NOTIFICATION RULE -> DELIVERY RECORD
 *
 * A delivery row is written for every attempt, including the ones that fail,
 * so a missing advisor email is diagnosable after the fact rather than lost
 * in the logs.
 */

/** Only email ships in V1; the column is text so SMS/Slack need no migration. */
export type NotificationChannel = "email";

export type NotificationStatus = "pending" | "sent" | "failed";

export interface NotificationDeliveryRecord {
  id: string;
  organization_id: string | null;
  lead_id: string | null;
  /** The activity_events row that triggered this, when the chain existed. */
  activity_event_id: string | null;
  event_type: string;
  channel: NotificationChannel;
  template_key: string;
  /** Null when no recipient could be resolved — the row records the failure. */
  recipient: string | null;
  status: NotificationStatus;
  provider: string | null;
  provider_message_id: string | null;
  error_message: string | null;
  /**
   * Uniqueness guard. Claiming this key is what makes a send happen, so a
   * retried request or a second delivery path cannot email twice.
   */
  dedupe_key: string;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateNotificationDeliveryInput {
  organization_id?: string | null;
  lead_id?: string | null;
  activity_event_id?: string | null;
  event_type: string;
  channel: NotificationChannel;
  template_key: string;
  recipient?: string | null;
  dedupe_key: string;
  status?: NotificationStatus;
}

export type NotificationDeliveryPatch = Partial<
  Pick<
    NotificationDeliveryRecord,
    "status" | "provider" | "provider_message_id" | "error_message" | "sent_at" | "recipient"
  >
>;
