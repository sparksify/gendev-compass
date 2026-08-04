import { NextResponse } from "next/server";
import { requireLead } from "@/lib/portal/api";
import { getStore } from "@/lib/store";
import { getPortalState } from "@/lib/portal/getPortalState";

export const dynamic = "force-dynamic";

/** Returns the prospect-safe view of portal state for the given token. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  const { token } = await params;
  const resolved = await requireLead(token);
  if ("response" in resolved) return resolved.response;
  const { lead } = resolved;

  const store = getStore();
  const [videoProgress, questionnaire] = await Promise.all([
    store.getVideoProgress(lead.id),
    store.getQuestionnaire(lead.id),
  ]);
  const state = getPortalState(lead, videoProgress, questionnaire);

  // Qualification score/reasons are internal-only and intentionally omitted.
  return NextResponse.json({
    success: true,
    firstName: lead.first_name,
    status: lead.status,
    state: {
      videoStarted: state.videoStarted,
      videoCompleted: state.videoCompleted,
      videoPercent: state.videoPercent,
      questionnaireCompleted: state.questionnaireCompleted,
      qualified: state.qualified,
      booked: state.booked,
      resumeRoute: state.resumeRoute,
    },
  });
}
