import { NextResponse } from "next/server";
import { requireLead } from "@/lib/portal/api";
import { applyVideoProgress } from "@/lib/portal/progress";
import { videoProgressSchema } from "@/lib/validation/videoProgress";
import { clientIpFrom, rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

/**
 * Receives playback progress reports from the Wistia player. The server is
 * the single source of truth for completion — the client never decides.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  const { token } = await params;

  if (!rateLimit(`video:${clientIpFrom(request)}`, 60, 60_000)) {
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
    const result = await applyVideoProgress(lead, parsed.data);
    return NextResponse.json({
      success: true,
      completed: result.completed,
      completedNow: result.completedNow,
      highestPercent: result.highestPercent,
    });
  } catch (error) {
    console.error("[video-progress] failed:", error);
    return NextResponse.json(
      { success: false, error: "Progress could not be saved" },
      { status: 500 },
    );
  }
}
