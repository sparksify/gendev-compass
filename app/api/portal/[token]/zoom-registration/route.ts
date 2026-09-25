import { NextResponse } from "next/server";
import { z } from "zod";
import { requireLead } from "@/lib/portal/api";
import { getCmdtZoomMeeting, registerCmdtZoomAttendee } from "@/lib/zoom/api";

export const dynamic = "force-dynamic";

const registrationSchema = z.object({
  occurrenceId: z.string().trim().min(1).max(100).optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  const { token } = await params;
  const resolved = await requireLead(token);
  if ("response" in resolved) return resolved.response;
  try {
    const meeting = await getCmdtZoomMeeting();
    return NextResponse.json({ success: true, meeting });
  } catch (error) {
    console.error("[zoom] schedule request failed", error);
    return NextResponse.json(
      { success: false, error: "The live overview schedule is temporarily unavailable." },
      { status: 503 },
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  const { token } = await params;
  const resolved = await requireLead(token);
  if ("response" in resolved) return resolved.response;
  const parsed = registrationSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Choose a valid Zoom session." }, { status: 400 });
  }
  const draft = resolved.lead.questionnaire_draft;
  const phone = resolved.lead.phone?.trim() ?? "";
  const city = typeof draft?.city === "string" ? draft.city.trim() : "";
  const zip = typeof draft?.postalCode === "string" ? draft.postalCode.trim() : "";
  if (!phone || !city) {
    return NextResponse.json({ success: false, error: "We’re missing required contact information from your assessment. Please contact the CMDT team." }, { status: 400 });
  }
  try {
    const registration = await registerCmdtZoomAttendee({
      firstName: resolved.lead.first_name,
      lastName: resolved.lead.last_name,
      email: resolved.lead.email,
      phone,
      city,
      state: resolved.lead.state ?? undefined,
      zip,
      country: "US",
      occurrenceId: parsed.data.occurrenceId,
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
