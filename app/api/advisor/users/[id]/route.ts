import { NextResponse } from "next/server";
import { z } from "zod";
import { getStore } from "@/lib/store";
import { requireStaffApi, sameOriginOk } from "@/lib/advisor/auth";
import { isAdmin } from "@/lib/advisor/access";

export const dynamic = "force-dynamic";

const patchSchema = z
  .object({
    leadScope: z.enum(["all", "gendev"]).optional(),
    active: z.boolean().optional(),
  })
  .refine((value) => value.leadScope !== undefined || value.active !== undefined, {
    message: "Nothing to update",
  });

/** Admin-only: change a team member's brand scope or active state. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  if (!sameOriginOk(request)) {
    return NextResponse.json({ success: false, error: "Invalid origin" }, { status: 403 });
  }
  const auth = await requireStaffApi();
  if ("response" in auth) return auth.response;
  if (!isAdmin(auth.user)) {
    return NextResponse.json({ success: false, error: "Admin access required" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid payload" }, { status: 400 });
  }

  const store = getStore();
  const target = await store.getStaffUserById(id);
  if (!target) {
    return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
  }

  try {
    const updated = await store.updateStaffUser(id, {
      ...(parsed.data.leadScope !== undefined ? { lead_scope: parsed.data.leadScope } : {}),
      ...(parsed.data.active !== undefined ? { active: parsed.data.active } : {}),
    });
    const { password_hash: _hash, ...safe } = updated;
    return NextResponse.json({ success: true, user: safe });
  } catch (error) {
    console.error("[advisor/users] update failed:", error);
    return NextResponse.json({ success: false, error: "Update failed" }, { status: 500 });
  }
}
