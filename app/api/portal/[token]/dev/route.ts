import { NextResponse } from "next/server";
import { z } from "zod";
import { requireLead } from "@/lib/portal/api";
import { getStore } from "@/lib/store";
import { statusRank } from "@/lib/store/types";
import { devToolsEnabled } from "@/lib/config/env";
import { trackEvent } from "@/lib/portal/events";
import { getVideoCompletionThreshold } from "@/lib/config/qualification";

export const dynamic = "force-dynamic";

const devActionSchema = z.object({
  action: z.enum(["simulate-video-completion", "reset-progress"]),
});

/**
 * Development-only helpers so the full flow can be tested without watching
 * the entire video (spec §36). Returns 404 outside development.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  if (!devToolsEnabled()) {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }

  const { token } = await params;
  const resolved = await requireLead(token);
  if ("response" in resolved) return resolved.response;
  const { lead } = resolved;

  const body = await request.json().catch(() => null);
  const parsed = devActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid payload" }, { status: 400 });
  }

  const store = getStore();
  const now = new Date().toISOString();

  if (parsed.data.action === "reset-progress") {
    await store.resetLeadProgress(lead.id);
    return NextResponse.json({ success: true, message: "Progress reset" });
  }

  const threshold = getVideoCompletionThreshold();
  await store.upsertVideoProgress(lead.id, {
    highest_percent_watched: Math.max(threshold, 85),
    accumulated_seconds_watched: 9999,
    started: true,
    completed: true,
    last_event_at: now,
  });
  await store.updateLead(lead.id, {
    video_started_at: lead.video_started_at ?? now,
    video_completed_at: lead.video_completed_at ?? now,
    ...(statusRank(lead.status) < statusRank("video_completed")
      ? { status: "video_completed" as const }
      : {}),
  });
  await trackEvent(lead, "video_completion_threshold_reached", { simulated: true });

  return NextResponse.json({ success: true, message: "Video completion simulated" });
}
