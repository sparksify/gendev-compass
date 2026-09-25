import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeZoomAuthorizationCode } from "@/lib/zoom/oauth";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const cookieStore = await cookies();
  const expectedState = cookieStore.get("zoom_oauth_state")?.value;
  const state = url.searchParams.get("state");
  const clearState = (response: NextResponse) => {
    response.cookies.delete("zoom_oauth_state");
    return response;
  };
  if (!expectedState || !state || state !== expectedState) {
    return clearState(NextResponse.redirect(new URL("/integrations/zoom/connected?status=state_error", url.origin)));
  }
  const code = url.searchParams.get("code");
  const denied = url.searchParams.get("error");
  if (!code || denied) {
    return clearState(NextResponse.redirect(new URL("/integrations/zoom/connected?status=denied", url.origin)));
  }
  try {
    await exchangeZoomAuthorizationCode(code);
    return clearState(NextResponse.redirect(new URL("/integrations/zoom/connected?status=success", url.origin)));
  } catch (error) {
    console.error("[zoom] OAuth callback failed", error);
    return clearState(NextResponse.redirect(new URL("/integrations/zoom/connected?status=error", url.origin)));
  }
}
