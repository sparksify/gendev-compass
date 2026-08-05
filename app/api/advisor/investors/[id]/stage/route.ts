import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffAndLead } from "@/lib/advisor/api";
import { isInvestorStage, setStageManually } from "@/lib/advisor/stages";
import { INVESTOR_STAGES } from "@/types/advisor";

export const dynamic = "force-dynamic";

const stageSchema = z.object({
  stage: z.enum(INVESTOR_STAGES),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const resolved = await requireStaffAndLead(request, id);
  if ("response" in resolved) return resolved.response;
  const { user, lead } = resolved;

  const body = await request.json().catch(() => null);
  const parsed = stageSchema.safeParse(body);
  if (!parsed.success || !isInvestorStage(parsed.data.stage)) {
    return NextResponse.json({ success: false, error: "Invalid stage" }, { status: 400 });
  }

  try {
    await setStageManually(lead, parsed.data.stage, user.id);
    return NextResponse.json({ success: true, stage: parsed.data.stage });
  } catch (error) {
    console.error("[advisor/stage] failed:", error);
    return NextResponse.json({ success: false, error: "Stage could not be updated" }, { status: 500 });
  }
}
