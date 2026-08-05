import { NextResponse } from "next/server";
import { startActivation } from "@/lib/portalActivation/service";
import { readActivationCookie, setActivationCookie } from "@/lib/portalActivation/cookies";
import { startActivationSchema } from "@/lib/validation/portalActivation";
import { clientIpFrom, rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

/**
 * Creates (or reuses) the opaque activation request for this browser. The
 * activation id lives only in an HTTP-only cookie — never in the response
 * body's URL and never persisted client-side by the caller.
 */
export async function POST(request: Request): Promise<NextResponse> {
  if (!rateLimit(`activation-start:${clientIpFrom(request)}`, 15, 60_000)) {
    return NextResponse.json(
      { activationId: null, status: "error", error: "Too many requests" },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ status: "error", error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = startActivationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ status: "error", error: "Invalid payload" }, { status: 400 });
  }

  const existingPublicId = readActivationCookie(request);
  const result = await startActivation(parsed.data, existingPublicId);

  if (!result.ok) {
    // Generic, safe error — never confirms/denies anything about the brand.
    return NextResponse.json({ status: "error", error: "Unable to start activation" }, { status: 400 });
  }

  const response = NextResponse.json({
    activationId: result.record.public_activation_id,
    status: result.record.status,
  });
  setActivationCookie(response, result.record.public_activation_id);
  return response;
}
