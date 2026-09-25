export const ZOOM_API_BASE = "https://api.zoom.us/v2";
export const ZOOM_TOKEN_URL = "https://zoom.us/oauth/token";
export const ZOOM_AUTHORIZE_URL = "https://zoom.us/oauth/authorize";

export function getZoomClientId(): string | null {
  return process.env.ZOOM_CLIENT_ID?.trim() || null;
}

export function getZoomClientSecret(): string | null {
  return process.env.ZOOM_CLIENT_SECRET?.trim() || null;
}

export function getZoomRedirectUri(): string | null {
  return process.env.ZOOM_REDIRECT_URI?.trim() || null;
}

export function getZoomMeetingId(): string | null {
  return process.env.ZOOM_MEETING_ID?.trim() || null;
}

export function zoomOAuthConfigured(): boolean {
  return Boolean(getZoomClientId() && getZoomClientSecret() && getZoomRedirectUri());
}

export function zoomRegistrationConfigured(): boolean {
  return Boolean(zoomOAuthConfigured() && getZoomMeetingId() && process.env.ZOOM_TOKEN_ENCRYPTION_KEY);
}
