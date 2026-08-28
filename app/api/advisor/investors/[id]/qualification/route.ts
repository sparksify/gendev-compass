import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffAndLead } from "@/lib/advisor/api";
import { setQualificationManually } from "@/lib/advisor/qualification";

export const dynamic = "force-dynamic";

const qualificationSchema = z.object({
  result: z.enum(["qualified", "review_required"]),
});

/** Manual qualification override — the Questionnaires board's drag target. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const resolved = await requireStaffAndLead(request, id);
  if ("response" in resolved) return resolved.response;
  const { user, lead } = resolved;

  const body = await request.json().catch(() => null);
  const parsed = qualificationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid qualification result" },
      { status: 400 },
    );
  }

  try {
    await setQualificationManually(lead, parsed.data.result, user.id);
    return NextResponse.json({ success: true, result: parsed.data.result });
  } catch (error) {
    console.error("[advisor/qualification] failed:", error);
    return NextResponse.json(
      { success: false, error: "Qualification could not be updated" },
      { status: 500 },
    );
  }
}
