import { getZoomMeetingId, zoomRegistrationConfigured } from "@/lib/zoom/config";
import { ZoomApiError, zoomRequest } from "@/lib/zoom/client";
import { findZoomRegistration, saveZoomRegistration } from "@/lib/zoom/storage";

export type ZoomRegistrationResult = {
  status: "registered" | "already_registered" | "failed" | "not_configured";
  joinUrl?: string;
  registrantId?: string;
};

function duplicateError(error: unknown): boolean {
  if (!(error instanceof ZoomApiError)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("already registered") ||
    message.includes("already exists") ||
    message.includes("registrant already") ||
    (message.includes("registered") && message.includes("email"))
  );
}

export async function registerZoomMeetingRegistrant(input: {
  leadId: string;
  firstName: string;
  lastName: string;
  email: string;
}): Promise<ZoomRegistrationResult> {
  if (!zoomRegistrationConfigured()) return { status: "not_configured" };
  const meetingId = getZoomMeetingId()!;
  const email = input.email.trim().toLowerCase();
  try {
    const existing = await findZoomRegistration(meetingId, email);
    if (existing?.status === "registered" || existing?.status === "already_registered") {
      return { status: existing.status, joinUrl: existing.join_url ?? undefined, registrantId: existing.registrant_id ?? undefined };
    }
    const result = await zoomRequest<{ registrant_id?: string; join_url?: string }>(`/meetings/${encodeURIComponent(meetingId)}/registrants`, {
      method: "POST",
      body: JSON.stringify({ first_name: input.firstName, last_name: input.lastName, email: input.email }),
    });
    await saveZoomRegistration({
      lead_id: input.leadId,
      meeting_id: meetingId,
      email_normalized: email,
      email: input.email,
      first_name: input.firstName,
      last_name: input.lastName,
      registrant_id: result.registrant_id ?? null,
      join_url: result.join_url ?? null,
      status: "registered",
      registered_at: new Date().toISOString(),
      last_error: null,
    });
    return { status: "registered", joinUrl: result.join_url, registrantId: result.registrant_id };
  } catch (error) {
    if (duplicateError(error)) {
      await saveZoomRegistration({
        lead_id: input.leadId,
        meeting_id: meetingId,
        email_normalized: email,
        email: input.email,
        first_name: input.firstName,
        last_name: input.lastName,
        status: "already_registered",
        registered_at: new Date().toISOString(),
        last_error: null,
      }).catch(() => undefined);
      return { status: "already_registered" };
    }
    await saveZoomRegistration({
      lead_id: input.leadId,
      meeting_id: meetingId,
      email_normalized: email,
      email: input.email,
      first_name: input.firstName,
      last_name: input.lastName,
      status: "failed",
      last_error: error instanceof Error ? error.message.slice(0, 500) : "Unknown Zoom error",
    }).catch(() => undefined);
    console.error("[zoom] registration failed:", error);
    return { status: "failed" };
  }
}
