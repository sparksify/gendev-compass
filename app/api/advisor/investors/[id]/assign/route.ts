import { NextResponse } from "next/server";
import { z } from "zod";
import { getStore } from "@/lib/store";
import { requireStaffAndLead } from "@/lib/advisor/api";
import { isAdmin } from "@/lib/advisor/access";
import { recordLeadEvent } from "@/lib/domain/activities";
import { resolveAdvisorContext } from "@/lib/domain/memberships";
import { assignAdvisorToOpportunity, resolvePrimaryOpportunity } from "@/lib/domain/opportunities";

export const dynamic = "force-dynamic";

const assignSchema = z.object({
  advisorId: z.string().uuid().nullable(),
});

/** Admin-only: assign (or unassign) an advisor to an investor. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const resolved = await requireStaffAndLead(request, id);
  if ("response" in resolved) return resolved.response;
  const { user, lead } = resolved;

  if (!isAdmin(user)) {
    return NextResponse.json({ success: false, error: "Admin access required" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = assignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid payload" }, { status: 400 });
  }

  const store = getStore();
  const advisorId = parsed.data.advisorId;
  let advisor = null;
  if (advisorId) {
    advisor = await store.getStaffUserById(advisorId);
    if (!advisor || !advisor.active) {
      return NextResponse.json({ success: false, error: "Unknown advisor" }, { status: 400 });
    }
  }

  try {
    const updatedLead = await store.updateLead(lead.id, { assigned_advisor_id: advisorId });

    // Project the assignment onto the primary opportunity (profile +
    // membership + assignment row). Failure is logged, never fatal — the
    // legacy lead column above is what the dashboard reads today.
    try {
      const opportunity = await resolvePrimaryOpportunity(updatedLead);
      if (opportunity) {
        const membership = advisor
          ? (await resolveAdvisorContext(advisor)).membership
          : null;
        await assignAdvisorToOpportunity(opportunity, membership);
      }
    } catch (syncError) {
      console.error("[advisor/assign] opportunity sync failed:", syncError);
    }

    await recordLeadEvent(
      updatedLead,
      "advisor_assigned",
      { previousAdvisorId: lead.assigned_advisor_id, advisorId },
      null,
      { source: "staff", staffUserId: user.id },
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[advisor/assign] failed:", error);
    return NextResponse.json({ success: false, error: "Assignment failed" }, { status: 500 });
  }
}
