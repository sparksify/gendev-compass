import { NextResponse } from "next/server";
import { requireLead } from "@/lib/portal/api";
import { getStore } from "@/lib/store";
import { pruneDraft, questionnaireDraftSchema } from "@/lib/validation/questionnaire";
import { clientIpFrom, rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

/**
 * Autosaves in-progress questionnaire answers so partially completed forms
 * are visible to the advisor and restorable if the prospect returns. The
 * payload is a lenient partial of the questionnaire — unknown keys are
 * stripped, invalid values dropped. Drafts stay in Supabase only; nothing
 * here is dispatched to analytics or advertising platforms (spec §12/§15).
 *
 * POST (not PATCH) so the form can flush a final save via
 * navigator.sendBeacon on pagehide.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  if (!rateLimit(`qdraft:${clientIpFrom(request)}`, 30, 60_000)) {
    return NextResponse.json({ success: false }, { status: 429 });
  }

  const { token } = await params;
  const resolved = await requireLead(token);
  if ("response" in resolved) return resolved.response;
  const { lead } = resolved;

  const store = getStore();

  // After final submit the validated answers are canonical — ignore any
  // straggling autosave (e.g. a beacon racing the redirect).
  const existing = await store.getQuestionnaire(lead.id);
  if (existing) {
    return NextResponse.json({ success: true, alreadySubmitted: true });
  }

  const body = await request.json().catch(() => null);
  const parsed = questionnaireDraftSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid payload" }, { status: 400 });
  }

  const draft = pruneDraft(parsed.data);
  if (Object.keys(draft).length === 0) {
    return NextResponse.json({ success: true, empty: true });
  }

  try {
    const now = new Date().toISOString();
    await store.updateLead(lead.id, {
      questionnaire_draft: draft,
      questionnaire_draft_saved_at: now,
      // A draft save is a genuine start signal; stamp it once.
      questionnaire_started_at: lead.questionnaire_started_at ?? now,
      last_activity_at: now,
    });
  } catch (error) {
    console.error("[questionnaire-draft] save failed:", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
