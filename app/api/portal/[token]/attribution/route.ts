import { NextResponse } from "next/server";
import { z } from "zod";
import { requireLead } from "@/lib/portal/api";
import { getStore } from "@/lib/store";
import {
  parseAttributionFromUrl,
  buildFirstTouchFields,
  buildLastTouchPatch,
  hasQualifiedTouch,
  withSynthesizedFbc,
} from "@/lib/tracking/attribution";
import { clientIpFrom, rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  url: z.string().trim().max(2000),
  referrer: z.string().trim().max(2000).nullable().optional(),
  fbp: z.string().trim().max(200).nullable().optional(),
  fbc: z.string().trim().max(200).nullable().optional(),
});

/**
 * Client-captured attribution (spec §4, §23): first-touch is written once
 * and never overwritten; last-touch updates only on a "qualified" visit —
 * one that actually carries a new UTM/click-ID signal, not every page view.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  if (!rateLimit(`attribution:${clientIpFrom(request)}`, 60, 60_000)) {
    return NextResponse.json({ success: false, error: "Too many requests." }, { status: 429 });
  }

  const { token } = await params;
  const resolved = await requireLead(token);
  if ("response" in resolved) return resolved.response;
  const { lead } = resolved;

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid payload" }, { status: 400 });
  }

  const now = new Date();
  const signal = withSynthesizedFbc(
    parseAttributionFromUrl(parsed.data.url, {
      referrer: parsed.data.referrer,
      fbp: parsed.data.fbp,
      fbc: parsed.data.fbc,
    }),
    now.getTime(),
  );

  const store = getStore();
  const nowIso = now.toISOString();

  try {
    if (!lead.first_touch_at) {
      await store.updateLead(lead.id, buildFirstTouchFields(signal, nowIso));
    }
    if (hasQualifiedTouch(signal)) {
      await store.updateLead(lead.id, buildLastTouchPatch(signal, nowIso));
    }
  } catch (error) {
    // Attribution capture must never break the portal experience.
    console.error(`[attribution] failed to record for lead ${lead.id}:`, error);
  }

  return NextResponse.json({ success: true });
}
