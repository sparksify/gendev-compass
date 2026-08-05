import { NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/advisor/auth";
import { isAdmin } from "@/lib/advisor/access";
import type { StaffUserRecord } from "@/types/advisor";

/**
 * Combines requireStaffApi + isAdmin for the Territory Advisor admin
 * routes, which are ADMIN-only (never ADVISOR, never a portal prospect).
 * Same 401/403 shape as the existing hand-inlined checks in
 * app/api/advisor/users/route.ts and app/api/advisor/export/route.ts.
 */
export async function requireAdminApi(): Promise<{ user: StaffUserRecord } | { response: NextResponse }> {
  const auth = await requireStaffApi();
  if ("response" in auth) return auth;
  if (!isAdmin(auth.user)) {
    return {
      response: NextResponse.json({ success: false, error: "Admin access required" }, { status: 403 }),
    };
  }
  return { user: auth.user };
}
