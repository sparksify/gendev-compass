import { NextResponse } from "next/server";
import { z } from "zod";
import { requireLead } from "@/lib/portal/api";
import { recordLeadEvent } from "@/lib/domain/activities";
import { clientIpFrom, rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

/**
 * Lightweight client-side event sink (device info, UI errors). Funnel-critical
 * events are recorded server-side by their own endpoints and cannot be
 * spoofed from here: client events are stored with a `client_` prefix.
 */
const clientEventSchema = z.object({
  token: z.string().trim().min(16).max(128),
  eventName: z.enum([
    "device_info",
    "video_error",
    "calendar_interaction",
    "consultation_slot_selected",
    "advisor_phone_clicked",
    "advisor_email_clicked",
    "questionnaire_started",
    "ui_error",
  ]),
  eventData: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
  pageUrl: z.string().trim().max(500).optional(),
});

export async function POST(request: Request): Promise<NextResponse> {
  if (!rateLimit(`events:${clientIpFrom(request)}`, 60, 60_000)) {
    return NextResponse.json({ success: false }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = clientEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid payload" }, { status: 400 });
  }

  const resolved = await requireLead(parsed.data.token);
  if ("response" in resolved) return resolved.response;

  // The questionnaire-start signal is client-originated (first field
  // interaction); advancing the low-stakes, forward-only pipeline stage on
  // it is acceptable — submission remains server-verified.
  if (parsed.data.eventName === "questionnaire_started") {
    const { autoAdvanceStage } = await import("@/lib/advisor/stages");
    await autoAdvanceStage(resolved.lead, "QUESTIONNAIRE_STARTED", "portal");
  }

  await recordLeadEvent(
    resolved.lead,
    `client_${parsed.data.eventName}`,
    parsed.data.eventData ?? null,
    parsed.data.pageUrl ?? null,
  );

  return NextResponse.json({ success: true });
}
