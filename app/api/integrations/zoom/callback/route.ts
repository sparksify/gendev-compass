import { NextResponse } from "next/server";
import { exchangeZoomAuthorizationCode } from "@/lib/zoom/oauth";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const denied = url.searchParams.get("error");
  if (!code || denied) {
    return NextResponse.redirect(new URL("/integrations/zoom/connected?status=denied", url.origin));
  }
  try {
    await exchangeZoomAuthorizationCode(code);
    return NextResponse.redirect(new URL("/integrations/zoom/connected?status=success", url.origin));
  } catch (error) {
    console.error("[zoom] OAuth callback failed", error);
    return NextResponse.redirect(new URL("/integrations/zoom/connected?status=error", url.origin));
  }
}
