import { NextResponse } from "next/server";
import { requireLead } from "@/lib/portal/api";
import { getStore } from "@/lib/store";
import { statusRank } from "@/lib/store/types";
import { trackEvent } from "@/lib/portal/events";

export const dynamic = "force-dynamic";

/** Records the first (and subsequent) portal opens. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  const { token } = await params;
  const resolved = await requireLead(token);
  if ("response" in resolved) return resolved.response;
  const { lead } = resolved;

  const body = (await request.json().catch(() => ({}))) as { page?: string };
  const page = typeof body.page === "string" ? body.page.slice(0, 200) : null;

  if (!lead.portal_first_opened_at) {
    await getStore().updateLead(lead.id, {
      portal_first_opened_at: new Date().toISOString(),
      ...(statusRank(lead.status) < statusRank("portal_opened")
        ? { status: "portal_opened" as const }
        : {}),
    });
    await trackEvent(lead, "portal_opened", null, page);
  }

  if (page === "overview") {
    await trackEvent(lead, "overview_page_opened", null, page);
  }

  return NextResponse.json({ success: true });
}
