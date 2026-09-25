import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getZoomClientId, getZoomClientSecret, getZoomRedirectUri, ZOOM_TOKEN_URL } from "@/lib/zoom/config";
import { saveZoomTokens } from "@/lib/zoom/storage";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const cookieStore = await cookies();
  const expectedState = cookieStore.get("zoom_oauth_state")?.value;
  const state = url.searchParams.get("state");
  const clear = (response: NextResponse) => { response.cookies.delete("zoom_oauth_state"); return response; };
  if (!expectedState || !state || state !== expectedState) return clear(NextResponse.redirect(new URL("/admin?zoom=state_error", request.url)));
  if (url.searchParams.get("error")) return clear(NextResponse.redirect(new URL("/admin?zoom=denied", request.url)));
  const code = url.searchParams.get("code");
  const clientId = getZoomClientId();
  const clientSecret = getZoomClientSecret();
  const redirectUri = getZoomRedirectUri();
  if (!code || !clientId || !clientSecret || !redirectUri) return clear(NextResponse.redirect(new URL("/admin?zoom=config_error", request.url)));
  try {
    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const tokenResponse = await fetch(`${ZOOM_TOKEN_URL}?grant_type=authorization_code&code=${encodeURIComponent(code)}&redirect_uri=${encodeURIComponent(redirectUri)}`, {
      method: "POST", headers: { Authorization: `Basic ${basic}` }, cache: "no-store",
    });
    const body = (await tokenResponse.json().catch(() => ({}))) as Record<string, unknown>;
    if (!tokenResponse.ok || typeof body.access_token !== "string" || typeof body.refresh_token !== "string") throw new Error("Zoom authorization failed");
    await saveZoomTokens({ accessToken: body.access_token, refreshToken: body.refresh_token, expiresIn: Number(body.expires_in) || 3600, zoomUserId: typeof body.user_id === "string" ? body.user_id : null, scopes: typeof body.scope === "string" ? body.scope.split(" ").filter(Boolean) : [] });
    return clear(NextResponse.redirect(new URL("/admin?zoom=connected", request.url)));
  } catch (error) {
    console.error("[zoom] OAuth callback failed:", error);
    return clear(NextResponse.redirect(new URL("/admin?zoom=error", request.url)));
  }
}
