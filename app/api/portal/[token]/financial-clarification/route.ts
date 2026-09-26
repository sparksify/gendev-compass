import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireLead } from "@/lib/portal/api";
import { recordLeadEvent } from "@/lib/domain/activities";
import { getStore } from "@/lib/store";
import { bridgeCapitalMeetsMinimum } from "@/lib/config/qualification";
import { LIQUID_CAPITAL_OPTIONS, TIMELINE_OPTIONS } from "@/lib/bridge/assessment";

export const dynamic = "force-dynamic";

const schema = z.object({
  liquidCapital: z.enum(LIQUID_CAPITAL_OPTIONS.map((option) => option.value) as [string, ...string[]]),
  householdAssetsIncluded: z.enum(["yes", "no", "not-sure"]),
  additionalResources: z.enum(["none", "household-assets", "other", "not-sure"]),
  timeline: z.enum(TIMELINE_OPTIONS.map((option) => option.value) as [string, ...string[]]),
});

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const resolved = await requireLead(token);
  if ("response" in resolved) return resolved.response;
  const { lead } = resolved;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, error: "Please answer each question." }, { status: 400 });

  const answers = parsed.data;
  const eventKey = createHash("sha256").update(JSON.stringify(answers)).digest("hex");
  await recordLeadEvent(lead, "financial_clarification_submitted", answers, `/p/${token}/financial-clarification`, {
    strict: true,
    eventKey: `financial-clarification:${eventKey}`,
    externalEventId: `financial-clarification:${lead.id}:${eventKey}`,
  });

  let updatedLead = lead;
  if (bridgeCapitalMeetsMinimum(answers.liquidCapital)) {
    updatedLead = await getStore().updateLead(lead.id, {
      initial_liquid_capital: answers.liquidCapital,
      last_activity_at: new Date().toISOString(),
    });
  }

  return NextResponse.json({
    success: true,
    qualified: bridgeCapitalMeetsMinimum(updatedLead.initial_liquid_capital),
    nextUrl: `/webinar/${token}`,
  });
}
