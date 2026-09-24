import { getAppUrl } from "@/lib/config/env";

/** Server-only Zoom integration settings. Never import this module in a client component. */
export function getZoomClientId(): string | null {
  return process.env.ZOOM_CLIENT_ID?.trim() || null;
}

export function getZoomClientSecret(): string | null {
  return process.env.ZOOM_CLIENT_SECRET?.trim() || null;
}

export function getZoomRedirectUri(): string {
  return (
    process.env.ZOOM_REDIRECT_URI?.trim() ||
    `${getAppUrl()}/api/integrations/zoom/callback`
  );
}

/** Numeric meeting ID from Kyle's recurring CMDT Zoom meeting. */
export function getZoomMeetingId(): string | null {
  return process.env.ZOOM_MEETING_ID?.replace(/\s/g, "") || null;
}

/** 32-byte hex or base64 key used only for Zoom OAuth tokens at rest. */
export function getZoomTokenEncryptionKey(): string | null {
  return process.env.ZOOM_TOKEN_ENCRYPTION_KEY?.trim() || null;
}

export function zoomOAuthConfigured(): boolean {
  return Boolean(getZoomClientId() && getZoomClientSecret());
}
