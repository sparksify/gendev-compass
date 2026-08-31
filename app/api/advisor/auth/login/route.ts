import { NextResponse } from "next/server";
import { z } from "zod";
import { getStore } from "@/lib/store";
import { verifyPassword } from "@/lib/advisor/password";
import { createSession, sameOriginOk, SESSION_COOKIE, sessionCookieOptions } from "@/lib/advisor/auth";
import { clientIpFrom, rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const loginSchema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(1).max(200),
  rememberMe: z.boolean().optional().default(false),
});

export async function POST(request: Request): Promise<NextResponse> {
  // Tight limit on credential guessing, per-IP and per-account.
  if (!rateLimit(`staff-login:${clientIpFrom(request)}`, 10, 60_000)) {
    return NextResponse.json(
      { success: false, error: "Too many attempts. Please wait a minute." },
      { status: 429 },
    );
  }
  if (!sameOriginOk(request)) {
    return NextResponse.json({ success: false, error: "Invalid origin" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid credentials" }, { status: 400 });
  }

  const { email, password, rememberMe } = parsed.data;
  if (!rateLimit(`staff-login-email:${email.toLowerCase()}`, 10, 60_000)) {
    return NextResponse.json(
      { success: false, error: "Too many attempts. Please wait a minute." },
      { status: 429 },
    );
  }

  const store = getStore();
  const user = await store.getStaffUserByEmail(email);
  // Same error for unknown email and wrong password — no account enumeration.
  if (!user || !user.active || !verifyPassword(password, user.password_hash)) {
    return NextResponse.json({ success: false, error: "Invalid email or password" }, { status: 401 });
  }

  const { token, expiresAt } = await createSession(user.id);
  await store.updateStaffUser(user.id, { last_login_at: new Date().toISOString() });

  // "Remember me" keeps the persistent cookie; otherwise the cookie is
  // session-scoped and clears when the browser closes (the server-side
  // session still expires on its own schedule either way).
  const { expires: _expires, ...sessionScoped } = sessionCookieOptions(expiresAt);
  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE, token, rememberMe ? sessionCookieOptions(expiresAt) : sessionScoped);
  return response;
}
