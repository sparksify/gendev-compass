import { NextResponse } from "next/server";
import { sameOriginOk } from "@/lib/advisor/auth";
import { requireAdminApi } from "@/lib/advisor/requireAdmin";
import { getStore } from "@/lib/store";
import { reviewRequestUpdateSchema } from "@/lib/validation/territory";

export const dynamic = "force-dynamic";

/** Update a territory review request's status/assignment/notes (Review Requests admin queue). */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  if (!sameOriginOk(request)) {
    return NextResponse.json({ success: false, error: "Invalid origin" }, { status: 403 });
  }
  const auth = await requireAdminApi();
  if ("response" in auth) return auth.response;
  const { id } = await params;

  const body = await request.json().catch(() => null);
  const parsed = reviewRequestUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid payload", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const store = getStore();
  const existing = await store.getTerritoryReviewRequest(id);
  if (!existing) {
    return NextResponse.json({ success: false, error: "Review request not found" }, { status: 404 });
  }

  try {
    const record = await store.updateTerritoryReviewRequest(id, {
      ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
      ...(parsed.data.assignedTo !== undefined ? { assigned_to: parsed.data.assignedTo } : {}),
      ...(parsed.data.internalNotes !== undefined ? { internal_notes: parsed.data.internalNotes } : {}),
      ...(parsed.data.status && parsed.data.status !== "new" && !existing.reviewed_at
        ? { reviewed_at: new Date().toISOString() }
        : {}),
    });
    return NextResponse.json({ success: true, review: record });
  } catch (error) {
    console.error("[advisor/territories/reviews/:id] failed:", error);
    return NextResponse.json({ success: false, error: "Could not update review request" }, { status: 500 });
  }
}
