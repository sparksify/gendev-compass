import { NextResponse } from "next/server";
import { z } from "zod";
import { getStore } from "@/lib/store";
import { requireStaffAndLead } from "@/lib/advisor/api";

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
    const note = await store.createNote(lead.id, user.id, parsed.data.note);
    await store.insertEvent(lead.id, "note_added", { noteId: note.id }, null, {
      source: "staff",
      staffUserId: user.id,
    });
    return NextResponse.json({ success: true, note });
  } catch (error) {
    console.error("[advisor/notes] failed:", error);
    return NextResponse.json({ success: false, error: "Note could not be saved" }, { status: 500 });
  }
}
