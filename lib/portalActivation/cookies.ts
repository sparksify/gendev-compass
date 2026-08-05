import type { NextResponse } from "next/server";
import { getActivationTtlMinutes } from "@/lib/config/portalActivation";
import { isProduction } from "@/lib/config/env";

/**
 * The activation cookie carries only an opaque, random activation id — never
 * an email, phone number, HighLevel contact id, or user id (spec: browser
 * correlation). Plain `Request`/`Response` are used elsewhere in this repo's
 * API routes, so cookies are read by parsing the `Cookie` header directly
 * rather than depending on `NextRequest`.
 */
export const ACTIVATION_COOKIE_NAME = "pa_id";

export function readActivationCookie(request: Request): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [rawKey, ...rest] = part.trim().split("=");
    if (rawKey === ACTIVATION_COOKIE_NAME) {
      return decodeURIComponent(rest.join("="));
    }
  }
  return null;
}

export function setActivationCookie(response: NextResponse, publicActivationId: string): void {
  response.cookies.set(ACTIVATION_COOKIE_NAME, publicActivationId, {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax",
    path: "/",
    maxAge: getActivationTtlMinutes() * 60,
  });
}
