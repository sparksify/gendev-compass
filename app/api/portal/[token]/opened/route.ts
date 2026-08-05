import { NextResponse } from "next/server";
import { requireLead } from "@/lib/portal/api";
import { getStore } from "@/lib/store";
import { statusRank } from "@/lib/store/types";
import { trackEvent } from "@/lib/portal/events";
import { autoAdvanceStage } from "@/lib/advisor/stages";

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

  const now = new Date().toISOString();
  if (!lead.portal_first_opened_at) {
    await getStore().updateLead(lead.id, {
      portal_first_opened_at: now,
      last_activity_at: now,
      ...(statusRank(lead.status) < statusRank("portal_opened")
        ? { status: "portal_opened" as const }
        : {}),
    });
    await autoAdvanceStage(lead, "PORTAL_ACTIVE", "portal");
    await trackEvent(lead, "portal_opened", null, page);
  } else {
    await getStore().updateLead(lead.id, { last_activity_at: now });
  }

  if (page === "overview") {
    await trackEvent(lead, "overview_page_opened", null, page);
  }

  return NextResponse.json({ success: true });
}
