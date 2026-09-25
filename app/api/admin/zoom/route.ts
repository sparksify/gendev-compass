import { NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/advisor/auth";
import { getZoomMeetingId, getZoomClientId, getZoomClientSecret, getZoomRedirectUri, zoomRegistrationConfigured } from "@/lib/zoom/config";
import { getZoomConnection } from "@/lib/zoom/storage";
import { inspectZoomToken } from "@/lib/zoom/client";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const auth = await requireStaffApi();
  if ("response" in auth) return auth.response;
  const configured = Boolean(getZoomClientId() && getZoomClientSecret() && getZoomRedirectUri());
  const meetingConfigured = Boolean(getZoomMeetingId());
  try {
    const connection = configured ? await getZoomConnection() : null;
    const tokenStatus = await inspectZoomToken();
    return NextResponse.json({ success: true, zoom: { configured, connected: Boolean(connection), meetingConfigured, registrationConfigured: zoomRegistrationConfigured(), tokenStatus, tokenExpiresAt: connection?.accessTokenExpiresAt ?? null, zoomUserId: connection?.zoomUserId ?? null } });
  } catch {
    return NextResponse.json({ success: true, zoom: { configured, connected: false, meetingConfigured, registrationConfigured: false, tokenExpiresAt: null, zoomUserId: null } });
  }
}
