import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { isProduction } from "@/lib/config/env";
import type { StaffUserRecord } from "@/types/advisor";

/**
 * Staff session handling. The browser holds a random token in an HttpOnly
 * cookie; the database stores only its SHA-256 hash, so a leaked database
 * row cannot be replayed as a session.
 */

export const SESSION_COOKIE = "staff_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(staffUserId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await getStore().createStaffSession(staffUserId, hashSessionToken(token), expiresAt.toISOString());
  return { token, expiresAt };
}

export function sessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax" as const,
    path: "/",
    expires: expiresAt,
  };
}

export async function destroySession(token: string): Promise<void> {
  await getStore().deleteStaffSession(hashSessionToken(token));
}

/** Resolves the active staff user from the session cookie, or null. */
export async function getCurrentStaffUser(): Promise<StaffUserRecord | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const store = getStore();
  const session = await store.getStaffSessionByHash(hashSessionToken(token));
  if (!session) return null;
  if (new Date(session.expires_at).getTime() <= Date.now()) {
    await store.deleteStaffSession(session.token_hash);
    return null;
  }

  const user = await store.getStaffUserById(session.staff_user_id);
  if (!user || !user.active) return null;
  return user;
}

/** Page guard: redirects to the login screen when unauthenticated. */
export async function requireStaffUser(): Promise<StaffUserRecord> {
  const user = await getCurrentStaffUser();
  if (!user) redirect("/advisor/login");
  return user;
}

/** API guard: returns the user or a 401 response. */
export async function requireStaffApi(): Promise<
  { user: StaffUserRecord } | { response: NextResponse }
> {
  const user = await getCurrentStaffUser();
  if (!user) {
    return {
      response: NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { user };
}

/**
 * CSRF defence for mutating staff APIs, layered on the SameSite=Lax cookie:
 * cross-origin requests that do arrive must carry a matching Origin.
 */
export function sameOriginOk(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true; // non-browser client (no ambient cookie risk)
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
