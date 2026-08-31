import { NextResponse } from "next/server";
import { z } from "zod";
import { getStore } from "@/lib/store";
import { requireStaffApi, sameOriginOk } from "@/lib/advisor/auth";
import { isAdmin } from "@/lib/advisor/access";
import { hashPassword } from "@/lib/advisor/password";

export const dynamic = "force-dynamic";

/** Admin-only staff user management (list + create). */

export async function GET(): Promise<NextResponse> {
  const auth = await requireStaffApi();
  if ("response" in auth) return auth.response;
  if (!isAdmin(auth.user)) {
    return NextResponse.json({ success: false, error: "Admin access required" }, { status: 403 });
  }

  const users = await getStore().listStaffUsers();
  return NextResponse.json({
    success: true,
    // Never return password hashes.
    users: users.map(withoutPasswordHash),
  });
}

function withoutPasswordHash<T extends { password_hash: string }>(user: T): Omit<T, "password_hash"> {
  const safe = { ...user } as Partial<T>;
  delete safe.password_hash;
  return safe as Omit<T, "password_hash">;
}

const createUserSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(320),
  password: z.string().min(12, "Password must be at least 12 characters").max(200),
  role: z.enum(["ADMIN", "ADVISOR"]),
  // Restricted by default: new staff only see GenDev-side leads unless
  // explicitly granted full visibility.
  leadScope: z.enum(["all", "gendev"]).default("gendev"),
});

export async function POST(request: Request): Promise<NextResponse> {
  if (!sameOriginOk(request)) {
    return NextResponse.json({ success: false, error: "Invalid origin" }, { status: 403 });
  }
  const auth = await requireStaffApi();
  if ("response" in auth) return auth.response;
  if (!isAdmin(auth.user)) {
    return NextResponse.json({ success: false, error: "Admin access required" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid payload", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const store = getStore();
  if (await store.getStaffUserByEmail(parsed.data.email)) {
    return NextResponse.json(
      { success: false, error: "A user with this email already exists" },
      { status: 409 },
    );
  }

  try {
    const user = await store.createStaffUser({
      first_name: parsed.data.firstName,
      last_name: parsed.data.lastName,
      email: parsed.data.email,
      password_hash: hashPassword(parsed.data.password),
      role: parsed.data.role,
      lead_scope: parsed.data.leadScope,
    });
    return NextResponse.json({ success: true, user: withoutPasswordHash(user) });
  } catch (error) {
    console.error("[advisor/users] failed:", error);
    return NextResponse.json({ success: false, error: "User could not be created" }, { status: 500 });
  }
}
