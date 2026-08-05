/**
 * Timestamp display helpers for the FDD workflow. All timestamps are stored
 * in UTC and rendered in the franchise brand's configured time zone. Safe to
 * import from client components.
 */

/** e.g. "August 4, 2026 at 7:21 PM CDT" */
export function formatDateTimeInZone(iso: string, timeZone: string): string {
  const date = new Date(iso);
  const day = new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
  return `${day} at ${time}`;
}

/** e.g. "August 20, 2026" */
export function formatDateInZone(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}
