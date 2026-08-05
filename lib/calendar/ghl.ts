import { getGhlConfig } from "@/lib/config/fdd";

/**
 * Read-only GoHighLevel calendar integration: fetches an advisor's booked
 * events for a given day directly from GoHighLevel, so the dashboard
 * reflects the real calendar rather than only what our own webhook-fed
 * appointment records happen to have synced.
 *
 * Reuses the same GHL_API_TOKEN / GHL_LOCATION_ID credentials already
 * configured for the FDD workflow (lib/config/fdd.ts) — only the calendar
 * ID is new.
 *
 * Environment variable:
 *   GHL_CALENDAR_ID   The GoHighLevel calendar ID for the advisor whose
 *                      bookings should appear on the dashboard (Darko's, for
 *                      the pilot). Find it in GoHighLevel under
 *                      Settings → Calendars → (calendar) → the ID in the URL.
 *
 * UNVERIFIED: built against GoHighLevel's documented v2 Calendar Events
 * response shape, but not yet exercised against a real account. Once
 * GHL_CALENDAR_ID is set, check the dashboard's Today section — if the
 * shape differs from what GoHighLevel actually returns, normalizeEvent()
 * below is the only place that needs adjusting.
 */

export function getGhlCalendarId(): string | null {
  return process.env.GHL_CALENDAR_ID ?? null;
}

export function isGhlCalendarConfigured(): boolean {
  const config = getGhlConfig();
  return Boolean(config.apiToken && config.locationId && getGhlCalendarId());
}

export interface GhlCalendarEvent {
  id: string;
  title: string;
  contactName: string | null;
  contactEmail: string | null;
  startTime: string;
  endTime: string;
  /** GoHighLevel's raw appointment status (e.g. "confirmed", "cancelled", "showed", "noshow"). */
  status: string;
}

export interface FetchTodayEventsResult {
  /** True once the request completed, regardless of whether it succeeded. */
  attempted: boolean;
  configured: boolean;
  events: GhlCalendarEvent[];
  error: string | null;
}

const GHL_API_BASE = "https://services.leadconnectorhq.com";
const REQUEST_TIMEOUT_MS = 8000;

function startAndEndOfDay(date: Date): { start: number; end: number } {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { start: start.getTime(), end: end.getTime() };
}

function normalizeEvent(raw: Record<string, unknown>): GhlCalendarEvent | null {
  const id = raw.id;
  const startTime = raw.startTime;
  if (typeof id !== "string" || typeof startTime !== "string") return null;

  const contact = (raw.contact ?? null) as Record<string, unknown> | null;
  const contactName = typeof contact?.name === "string" ? contact.name : null;
  const contactEmail = typeof contact?.email === "string" ? contact.email : null;

  return {
    id,
    title: typeof raw.title === "string" && raw.title ? raw.title : contactName || "Consultation",
    contactName,
    contactEmail,
    startTime,
    endTime: typeof raw.endTime === "string" ? raw.endTime : startTime,
    status: typeof raw.appointmentStatus === "string" ? raw.appointmentStatus : "unknown",
  };
}

/**
 * Fetches the configured advisor calendar's events for the given local day.
 * Returns configured: false (no error) when GHL_CALENDAR_ID isn't set yet —
 * the dashboard shows a setup prompt rather than an error in that case.
 */
export async function fetchGhlCalendarEventsForDay(date: Date): Promise<FetchTodayEventsResult> {
  const config = getGhlConfig();
  const calendarId = getGhlCalendarId();

  if (!config.apiToken || !config.locationId || !calendarId) {
    return { attempted: false, configured: false, events: [], error: null };
  }

  const { start, end } = startAndEndOfDay(date);
  const params = new URLSearchParams({
    locationId: config.locationId,
    calendarId,
    startTime: String(start),
    endTime: String(end),
  });

  try {
    const response = await fetch(`${GHL_API_BASE}/calendars/events?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${config.apiToken}`,
        Version: "2021-07-28",
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      return {
        attempted: true,
        configured: true,
        events: [],
        error: `GoHighLevel calendar request responded ${response.status}`,
      };
    }

    const data = (await response.json().catch(() => null)) as {
      events?: Array<Record<string, unknown>>;
    } | null;

    const events = (data?.events ?? [])
      .map(normalizeEvent)
      .filter((event): event is GhlCalendarEvent => event !== null)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));

    return { attempted: true, configured: true, events, error: null };
  } catch (error) {
    console.error("[calendar/ghl] fetch failed:", error);
    return {
      attempted: true,
      configured: true,
      events: [],
      error: error instanceof Error ? error.message : "GoHighLevel calendar request failed",
    };
  }
}
