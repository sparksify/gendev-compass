import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { resolveLastFour } from "@/lib/portalActivation/service";
import { readActivationCookie } from "@/lib/portalActivation/cookies";
import { phoneLastFourSchema } from "@/lib/validation/portalActivation";
import { clientIpFrom, rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

/**
 * The MVP fallback: last four digits of the phone number used on the
 * Facebook form. Never reveals how many leads matched (spec: no enumeration
 * signal) — ambiguous and zero-match responses look identical in shape.
 */
export async function POST(request: Request): Promise<NextResponse> {
  if (!rateLimit(`last-four-ip:${clientIpFrom(request)}`, 30, 60_000)) {
    return NextResponse.json({ status: "error", error: "Too many requests" }, { status: 429 });
  }

  const publicId = readActivationCookie(request);
  if (!publicId) {
    return NextResponse.json({ status: "expired" });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ status: "error", error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = phoneLastFourSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ status: "error", error: "Enter exactly four digits" }, { status: 400 });
  }

  const store = getStore();
  const activation = await store.getActivationByPublicId(publicId);
  if (!activation) {
    return NextResponse.json({ status: "expired" });
  }

  // Per-activation attempt limit is authoritative (lib/portalActivation/service.ts);
  // this IP limit is defense in depth against distributed guessing.
  if (!rateLimit(`last-four-activation:${activation.id}`, 10, 60_000)) {
    return NextResponse.json({ status: "manual_resolution_required" });
  }

  const result = await resolveLastFour(activation, parsed.data.phoneLastFour);
  return NextResponse.json(result);
}
