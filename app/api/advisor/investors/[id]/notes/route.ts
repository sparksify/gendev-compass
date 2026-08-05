import { NextResponse } from "next/server";
import { z } from "zod";
import { getStore } from "@/lib/store";
import { requireStaffAndLead } from "@/lib/advisor/api";
import { recordLeadEvent } from "@/lib/domain/activities";
import { resolveAdvisorContext } from "@/lib/domain/memberships";

export const dynamic = "force-dynamic";

const noteSchema = z.object({
  note: z.string().trim().min(1, "Note cannot be empty").max(10_000),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const resolved = await requireStaffAndLead(request, id);
  if ("response" in resolved) return resolved.response;
  const { user, lead } = resolved;

  const body = await request.json().catch(() => null);
  const parsed = noteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid note" }, { status: 400 });
  }

  try {
    const store = getStore();
    // Note linkage: notes created from the investor screen are
    // opportunity-specific (the lead's primary opportunity). Author profile
    // resolution failure never blocks the note.
    let authorProfileId: string | null = null;
    try {
      authorProfileId = (await resolveAdvisorContext(user)).profile.id;
    } catch (profileError) {
      console.error("[advisor/notes] profile resolution failed:", profileError);
    }
    const note = await store.createNote(lead.id, user.id, parsed.data.note, {
      organization_id: lead.organization_id,
      client_id: lead.client_id,
      opportunity_id: lead.primary_opportunity_id,
      author_profile_id: authorProfileId,
    });
    await recordLeadEvent(lead, "note_added", { noteId: note.id }, null, {
      source: "staff",
      staffUserId: user.id,
      actorProfileId: authorProfileId,
    });
    return NextResponse.json({ success: true, note });
  } catch (error) {
    console.error("[advisor/notes] failed:", error);
    return NextResponse.json({ success: false, error: "Note could not be saved" }, { status: 500 });
  }
}
