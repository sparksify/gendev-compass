import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { requireStaffApi, sameOriginOk } from "./auth";
import { canAccessLead } from "./access";
import type { StaffUserRecord } from "@/types/advisor";
import type { LeadRecord } from "@/types/lead";

/**
 * Guard for staff APIs that operate on one investor: authenticates the
 * staff user, checks same-origin, loads the lead, and enforces role-based
 * access — all server-side.
 */
export async function requireStaffAndLead(
  request: Request,
  leadId: string,
): Promise<{ user: StaffUserRecord; lead: LeadRecord } | { response: NextResponse }> {
  if (!sameOriginOk(request)) {
    return {
      response: NextResponse.json({ success: false, error: "Invalid origin" }, { status: 403 }),
    };
  }

  const auth = await requireStaffApi();
  if ("response" in auth) return auth;

  const lead = await getStore().getLeadById(leadId);
  if (!lead) {
    return {
      response: NextResponse.json({ success: false, error: "Investor not found" }, { status: 404 }),
    };
  }
  if (!canAccessLead(auth.user, lead)) {
    // 404, not 403 — don't reveal that the investor exists.
    return {
      response: NextResponse.json({ success: false, error: "Investor not found" }, { status: 404 }),
    };
  }

  return { user: auth.user, lead };
}
