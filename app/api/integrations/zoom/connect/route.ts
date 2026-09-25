import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/advisor/auth";
import { getZoomClientId, getZoomRedirectUri, zoomOAuthConfigured } from "@/lib/config/zoom";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  const auth = await requireStaffApi();
  if ("response" in auth) return auth.response;
  const clientId = getZoomClientId();
  if (!zoomOAuthConfigured() || !clientId) {
    return NextResponse.json({ success: false, error: "Zoom OAuth is not configured" }, { status: 503 });
  }

  const state = randomBytes(32).toString("base64url");
  const authorizeUrl = new URL("https://zoom.us/oauth/authorize");
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", getZoomRedirectUri());
  authorizeUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set("zoom_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return response;
}
