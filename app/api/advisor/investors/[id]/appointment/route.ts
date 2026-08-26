import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffAndLead } from "@/lib/advisor/api";
import { getStore } from "@/lib/store";
import { recordLeadEvent } from "@/lib/domain/activities";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  appointmentId: z.string().min(1),
  status: z.enum(["COMPLETED", "NO_SHOW"]),
});

/**
 * Marks a scheduled activity done from the client detail page's activity
 * row. Deliberately narrow: staff may only close out an appointment that
 * belongs to the lead in the path, and only into a terminal outcome —
 * booking and rescheduling stay with the calendar integration.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const resolved = await requireStaffAndLead(request, id);
  if ("response" in resolved) return resolved.response;
  const { user, lead } = resolved;

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid request" }, { status: 400 });
  }
  const { appointmentId, status } = parsed.data;

  try {
    const store = getStore();
    const appointments = await store.getAppointmentsForLead(lead.id);
    // Never let an id from the request body reach another lead's record.
    const appointment = appointments.find((entry) => entry.id === appointmentId);
    if (!appointment) {
      return NextResponse.json({ success: false, error: "Appointment not found" }, { status: 404 });
    }

    const updated = await store.updateAppointment(appointment.id, { status });
    await recordLeadEvent(
      lead,
      status === "COMPLETED" ? "consultation_completed" : "consultation_no_show",
      { appointmentId: appointment.id, manual: true },
      null,
      { source: "staff", staffUserId: user.id },
    );

    return NextResponse.json({ success: true, appointment: updated });
  } catch (error) {
    console.error("[advisor/appointment] failed:", error);
    return NextResponse.json(
      { success: false, error: "Appointment could not be updated" },
      { status: 500 },
    );
  }
}
