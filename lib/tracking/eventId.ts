import { randomUUID } from "crypto";

/**
 * The stable event ID shared between the browser (Meta Pixel `eventID`) and
 * the server (Meta CAPI `event_id`) for deduplication (spec §9). Generated
 * exactly once per portal event, server-side, and threaded through: never
 * generate a second ID for the same logical event.
 */
export function generateEventId(): string {
  return `evt_${randomUUID().replace(/-/g, "")}`;
}
