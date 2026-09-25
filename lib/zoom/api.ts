import { getZoomMeetingId } from "@/lib/config/zoom";
import { getZoomAccessToken } from "@/lib/zoom/oauth";

export interface ZoomOccurrence {
  occurrenceId: string;
  startTime: string;
  duration: number;
  status: string;
}

export interface ZoomMeetingSummary {
  topic: string;
  timezone: string;
  registrationType: number | null;
  occurrences: ZoomOccurrence[];
}

async function zoomFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = await getZoomAccessToken();
  return fetch(`https://api.zoom.us/v2${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });
}

function meetingPath(suffix = ""): string {
  const meetingId = getZoomMeetingId();
  if (!meetingId) throw new Error("ZOOM_MEETING_ID is not configured");
  return `/meetings/${encodeURIComponent(meetingId)}${suffix}`;
}

export async function getCmdtZoomMeeting(): Promise<ZoomMeetingSummary> {
  const response = await zoomFetch(meetingPath());
  const body = await response.json().catch(() => null) as {
    topic?: string;
    timezone?: string;
    settings?: { registration_type?: number };
    occurrences?: Array<{ occurrence_id?: string; start_time?: string; duration?: number; status?: string }>;
    message?: string;
  } | null;
  if (!response.ok) {
    console.error("[zoom] meeting lookup failed", response.status, body?.message ?? "unknown response");
    throw new Error("The live overview schedule is temporarily unavailable");
  }
  return {
    topic: body?.topic ?? "CMDT Live Overview",
    timezone: body?.timezone ?? "America/Chicago",
    registrationType: body?.settings?.registration_type ?? null,
    occurrences: (body?.occurrences ?? [])
      .filter((item): item is Required<typeof item> => Boolean(item.occurrence_id && item.start_time))
      .map((item) => ({
        occurrenceId: item.occurrence_id,
        startTime: item.start_time,
        duration: item.duration ?? 60,
        status: item.status ?? "available",
      }))
      .filter((item) => item.status !== "deleted" && new Date(item.startTime).getTime() > Date.now() - 60_000)
      .slice(0, 8),
  };
}

export async function registerCmdtZoomAttendee(input: {
  firstName: string;
  lastName: string;
  email: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  occurrenceId?: string;
}): Promise<{ registrantId: string; joinUrl: string | null; alreadyRegistered?: boolean }> {
  const query = input.occurrenceId ? `?occurrence_ids=${encodeURIComponent(input.occurrenceId)}` : "";
  const response = await zoomFetch(meetingPath(`/registrants${query}`), {
    method: "POST",
    body: JSON.stringify({
      first_name: input.firstName,
      last_name: input.lastName,
      email: input.email,
      ...(input.city ? { city: input.city } : {}),
      ...(input.state ? { state: input.state } : {}),
      ...(input.zip ? { zip: input.zip } : {}),
      ...(input.country ? { country: input.country } : {}),
    }),
  });
  const body = await response.json().catch(() => null) as {
    id?: string;
    registrant_id?: string;
    join_url?: string;
    code?: number;
    message?: string;
  } | null;
  if (!response.ok && (body?.code === 3001 || /already registered/i.test(body?.message ?? ""))) {
    console.warn("[zoom] prospect was already registered", input.email);
    return { registrantId: body?.registrant_id ?? body?.id ?? "", joinUrl: null, alreadyRegistered: true };
  }
  if (!response.ok || !body?.join_url) {
    console.error("[zoom] registrant creation failed", response.status, body?.message ?? "unknown response");
    throw new Error(body?.message || "Zoom registration could not be completed");
  }
  return { registrantId: body.registrant_id ?? body.id ?? "", joinUrl: body.join_url };
}
