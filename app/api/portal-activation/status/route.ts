import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { pollActivation, redirectUrlFor } from "@/lib/portalActivation/service";
import { readActivationCookie } from "@/lib/portalActivation/cookies";
import { clientIpFrom, rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

/**
 * Polled every 1–2 seconds by the activation page. Never returns the
 * matched lead's name, email, phone, or any HighLevel identifier — only a
 * status and, once matched, the portal redirect URL (spec: no private data
 * before authentication).
 */
export async function GET(request: Request): Promise<NextResponse> {
  const publicId = readActivationCookie(request);
  if (!publicId) {
    return NextResponse.json({ status: "expired" });
  }

  if (!rateLimit(`activation-status:${publicId}`, 60, 60_000)) {
    return NextResponse.json({ status: "error", error: "Too many requests" }, { status: 429 });
  }
  if (!rateLimit(`activation-status-ip:${clientIpFrom(request)}`, 240, 60_000)) {
    return NextResponse.json({ status: "error", error: "Too many requests" }, { status: 429 });
  }

  const store = getStore();
  const activation = await store.getActivationByPublicId(publicId);
  if (!activation) {
    return NextResponse.json({ status: "expired" });
  }

  const updated = await pollActivation(activation);

  switch (updated.status) {
    case "expired":
      return NextResponse.json({ status: "expired" });
    case "fallback_required":
      return NextResponse.json({ status: "fallback_required", fallbackType: "phone_last_four" });
    case "ready": {
      const lead = updated.portal_lead_id ? await store.getLeadById(updated.portal_lead_id) : null;
      if (!lead) return NextResponse.json({ status: "pending" });
      return NextResponse.json({
        status: "ready",
        redirectUrl: redirectUrlFor(updated.brand_slug, lead),
      });
    }
    default:
      return NextResponse.json({ status: "pending" });
  }
}
