import { NextResponse } from "next/server";
import { z } from "zod";
import { getStore } from "@/lib/store";
import { requireStaffApi, sameOriginOk } from "@/lib/advisor/auth";
import { hashPassword, verifyPassword } from "@/lib/advisor/password";

export const dynamic = "force-dynamic";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(12, "New password must be at least 12 characters").max(200),
});

/**
 * Self-service password change for the logged-in staff user (any role).
 * Requires the current password — a stolen session alone can't rotate the
 * credential.
 */
export async function PATCH(request: Request): Promise<NextResponse> {
  if (!sameOriginOk(request)) {
    return NextResponse.json({ success: false, error: "Invalid origin" }, { status: 403 });
  }
  const auth = await requireStaffApi();
  if ("response" in auth) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = changePasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid payload", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  if (!verifyPassword(parsed.data.currentPassword, auth.user.password_hash)) {
    return NextResponse.json(
      { success: false, error: "Current password is incorrect" },
      { status: 403 },
    );
  }

  try {
    await getStore().updateStaffUser(auth.user.id, {
      password_hash: hashPassword(parsed.data.newPassword),
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[advisor/users/me] password change failed:", error);
    return NextResponse.json(
      { success: false, error: "Password could not be changed" },
      { status: 500 },
    );
  }
}
