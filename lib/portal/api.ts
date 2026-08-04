import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import type { LeadRecord } from "@/types/lead";

/**
 * Loads the lead for a portal token or returns the standard invalid-portal
 * response. Tokens are the only credential in the MVP, so every portal API
 * must resolve the lead through this helper.
 */
export async function requireLead(
  token: string,
): Promise<{ lead: LeadRecord } | { response: NextResponse }> {
  if (!token || token.length < 16 || token.length > 128) {
    return { response: invalidPortalResponse() };
  }
  try {
    const lead = await getStore().getLeadByToken(token);
    if (!lead) return { response: invalidPortalResponse() };
    return { lead };
  } catch (error) {
    console.error("[portal] failed to resolve token:", error);
    return {
      response: NextResponse.json(
        { success: false, error: "We could not access your portal. Please try again." },
        { status: 500 },
      ),
    };
  }
}

export function invalidPortalResponse(): NextResponse {
  return NextResponse.json(
    { success: false, error: "This portal link is invalid or has expired." },
    { status: 404 },
  );
}

export function serverErrorResponse(message: string): NextResponse {
  return NextResponse.json({ success: false, error: message }, { status: 500 });
}
