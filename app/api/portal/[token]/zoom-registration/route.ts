import { NextResponse } from "next/server";
import { requireLead } from "@/lib/portal/api";
import { registerCmdtZoomAttendee } from "@/lib/zoom/api";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  const { token } = await params;
  const resolved = await requireLead(token);
  if ("response" in resolved) return resolved.response;
  try {
    const registration = await registerCmdtZoomAttendee({
      firstName: resolved.lead.first_name,
      lastName: resolved.lead.last_name,
      email: resolved.lead.email,
    });
    return NextResponse.json({ success: true, ...registration });
  } catch (error) {
    console.error("[zoom] prospect registration failed", error);
    return NextResponse.json(
      { success: false, error: "We couldn’t complete the Zoom registration yet. Please use the standard Zoom registration page below." },
      { status: 502 },
    );
  }
}
