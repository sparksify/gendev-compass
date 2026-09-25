import { getZoomClientId, getZoomClientSecret, ZOOM_API_BASE, ZOOM_TOKEN_URL } from "@/lib/zoom/config";
import { decryptConnectionTokens, getZoomConnection, saveZoomTokens } from "@/lib/zoom/storage";

export class ZoomApiError extends Error {
  constructor(public readonly status: number, message: string, public readonly code?: number) {
    super(message);
    this.name = "ZoomApiError";
  }
}

async function refreshAccessToken(): Promise<string> {
  const connection = await getZoomConnection();
  const clientId = getZoomClientId();
  const clientSecret = getZoomClientSecret();
  if (!connection || !clientId || !clientSecret) throw new ZoomApiError(401, "Zoom is not connected");
  const { refreshToken } = decryptConnectionTokens(connection);
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetch(`${ZOOM_TOKEN_URL}?grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}` },
    cache: "no-store",
  });
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok || typeof body.access_token !== "string" || typeof body.refresh_token !== "string") {
    throw new ZoomApiError(response.status, typeof body.reason === "string" ? body.reason : "Zoom token refresh failed");
  }
  await saveZoomTokens({
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    expiresIn: Number(body.expires_in) || 3600,
    zoomUserId: typeof body.user_id === "string" ? body.user_id : connection.zoomUserId,
    scopes: typeof body.scope === "string" ? body.scope.split(" ").filter(Boolean) : connection.scopes,
  });
  return body.access_token;
}

async function currentAccessToken(): Promise<string> {
  const connection = await getZoomConnection();
  if (!connection) throw new ZoomApiError(401, "Zoom is not connected");
  if (new Date(connection.accessTokenExpiresAt).getTime() > Date.now()) {
    return decryptConnectionTokens(connection).accessToken;
  }
  return refreshAccessToken();
}

export async function inspectZoomToken(): Promise<"not_connected" | "valid" | "refreshed" | "refresh_failed"> {
  const connection = await getZoomConnection();
  if (!connection) return "not_connected";
  if (new Date(connection.accessTokenExpiresAt).getTime() > Date.now()) return "valid";
  try {
    await refreshAccessToken();
    return "refreshed";
  } catch {
    return "refresh_failed";
  }
}

export async function zoomRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  let token = await currentAccessToken();
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetch(`${ZOOM_API_BASE}${path}`, {
      ...init,
      headers: { Accept: "application/json", "Content-Type": "application/json", ...(init.headers ?? {}), Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (response.ok) return body as T;
    if (response.status === 401 && attempt === 0) {
      token = await refreshAccessToken();
      continue;
    }
    throw new ZoomApiError(response.status, typeof body.message === "string" ? body.message : "Zoom API request failed", typeof body.code === "number" ? body.code : undefined);
  }
  throw new ZoomApiError(401, "Zoom API authorization failed");
}
