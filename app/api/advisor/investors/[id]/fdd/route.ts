import { NextResponse } from "next/server";
import { requireStaffAndLead } from "@/lib/advisor/api";
import { requestFdd } from "@/lib/fdd/workflow";
import { clientIpFrom } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

/**
 * Advisor-triggered FDD request/resend, backing the "Request FDD" /
 * "Resend FDD" action on the client detail page. Same underlying workflow
 * as the prospect-facing request and the admin resend tool
 * (lib/fdd/workflow.ts) — idempotent unless `force` is set, which the UI
 * only sends once a request is already in flight.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const resolved = await requireStaffAndLead(request, id);
  if ("response" in resolved) return resolved.response;
  const { user, lead } = resolved;

  const body = await request.json().catch(() => ({}));
  const force = body && typeof body === "object" && "force" in body ? Boolean(body.force) : false;

  try {
    const result = await requestFdd(
      lead,
      { source: "advisor_dashboard", actor: user.email, ip: clientIpFrom(request) },
      { force },
    );
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error ?? "Request failed" }, { status: 500 });
    }
    return NextResponse.json({ success: true, alreadyRequested: result.alreadyRequested, lead: result.lead });
  } catch (error) {
    console.error("[advisor/fdd] request failed:", error);
    return NextResponse.json({ success: false, error: "FDD request failed" }, { status: 500 });
  }
}
