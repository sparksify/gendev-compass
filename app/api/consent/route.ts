import { NextResponse } from "next/server";
import { z } from "zod";
import { getStore } from "@/lib/store";
import { writeConsentCookie, CONSENT_VERSION } from "@/lib/tracking/consent";
import { clientIpFrom, rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const consentSchema = z.object({
  analytics: z.boolean(),
  marketing: z.boolean(),
  portalToken: z.string().trim().max(200).optional(),
});

/** Records a marketing/analytics consent decision (spec §20). Necessary is implicit and always true. */
export async function POST(request: Request): Promise<NextResponse> {
  if (!rateLimit(`consent:${clientIpFrom(request)}`, 30, 60_000)) {
    return NextResponse.json({ success: false, error: "Too many requests." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = consentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid payload" }, { status: 400 });
  }

  const { analytics, marketing, portalToken } = parsed.data;
  await writeConsentCookie({ analytics, marketing });

  try {
    const store = getStore();
    const lead = portalToken ? await store.getLeadByToken(portalToken) : null;
    await store.insertConsent({
      lead_id: lead?.id ?? null,
      portal_token: portalToken ?? null,
      necessary: true,
      analytics,
      marketing,
      consent_version: CONSENT_VERSION,
      ip_address: clientIpFrom(request),
      user_agent: request.headers.get("user-agent"),
    });
  } catch (error) {
    // The cookie is already set — the portal experience is unaffected even
    // if the durable log write fails.
    console.error("[consent] failed to record consent:", error);
  }

  return NextResponse.json({ success: true });
}
