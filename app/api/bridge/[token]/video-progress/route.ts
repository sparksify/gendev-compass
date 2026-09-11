import { NextResponse } from "next/server";
import { requireLead } from "@/lib/portal/api";
import { videoProgressSchema } from "@/lib/validation/videoProgress";
import { clientIpFrom, rateLimit } from "@/lib/rateLimit";
import { applyBridgeVideoProgress } from "@/lib/bridge/videoProgress";

export const dynamic = "force-dynamic";

/**
 * Playback reports from the bridge page's Wistia player for a known lead.
 * Same payload as the portal's /api/portal/[token]/video-progress; the
 * server decides what counts (lib/bridge/videoProgress.ts).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  const { token } = await params;

  if (!rateLimit(`bridge-video:${clientIpFrom(request)}`, 60, 60_000)) {
    return NextResponse.json({ success: false, error: "Too many requests" }, { status: 429 });
  }

  const resolved = await requireLead(token);
  if ("response" in resolved) return resolved.response;
  const { lead } = resolved;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = videoProgressSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid payload" }, { status: 400 });
  }

  try {
    const summary = await applyBridgeVideoProgress(lead, parsed.data);
    return NextResponse.json({
      success: true,
      completed: summary.completed,
      highestPercent: summary.highestPercent,
    });
  } catch (error) {
    console.error("[bridge-video] failed:", error);
    return NextResponse.json(
      { success: false, error: "Progress could not be saved" },
      { status: 500 },
    );
  }
}
