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
    "location_section_completed",
    "funding_section_started",
    "funding_section_completed",
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
  let tracking: unknown = undefined;
  if (parsed.data.eventName === "questionnaire_started") {
    const { autoAdvanceStage } = await import("@/lib/advisor/stages");
    await autoAdvanceStage(resolved.lead, "QUESTIONNAIRE_STARTED", "portal");
    // Stamp the actual start time (previously only set at submit).
    if (!resolved.lead.questionnaire_started_at) {
      try {
        const { getStore } = await import("@/lib/store");
        await getStore().updateLead(resolved.lead.id, {
          questionnaire_started_at: new Date().toISOString(),
        });
      } catch (error) {
        console.error("[events] failed to stamp questionnaire_started_at:", error);
      }
    }
    // questionnaire_started is tier 4 in the taxonomy (GTM + Meta browser
    // Pixel) — dispatch through the central tracking layer and hand the
    // browser payloads back so the client fires them with the same dedup
    // ID. Storage below keeps the client_ prefix; only the dispatch uses
    // the canonical name.
    try {
      const { dispatchPortalEvent } = await import("@/lib/tracking/dispatch");
      const result = await dispatchPortalEvent(resolved.lead, "questionnaire_started", {
        pageUrl: parsed.data.pageUrl ?? null,
      });
      tracking = {
        eventId: result.eventId,
        dataLayerPayload: result.dataLayerPayload,
        metaPixelBrowser: result.metaPixelBrowser,
      };
    } catch (error) {
      console.error("[events] tracking dispatch failed for questionnaire_started:", error);
    }
  }

  await recordLeadEvent(
    resolved.lead,
    `client_${parsed.data.eventName}`,
    parsed.data.eventData ?? null,
    parsed.data.pageUrl ?? null,
  );

  return NextResponse.json({ success: true, ...(tracking ? { tracking } : {}) });
}
