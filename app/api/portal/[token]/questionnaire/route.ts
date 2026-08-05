import { NextResponse } from "next/server";
import { requireLead } from "@/lib/portal/api";
import { getStore } from "@/lib/store";
import { statusRank } from "@/lib/store/types";
import { trackEvent } from "@/lib/portal/events";
import { evaluateQualification } from "@/lib/portal/qualification";
import { questionnaireSchema } from "@/lib/validation/questionnaire";
import type { QuestionnaireInput } from "@/types/questionnaire";

export const dynamic = "force-dynamic";

/**
 * Saves questionnaire responses and runs server-side qualification.
 * The questionnaire is open to every prospect — the investor overview is
 * an optional educational path, and experienced investors may fast-track
 * directly to qualification. Video completion still feeds the score.
 *
 * Qualification is recorded for the advisor's preparation but does not
 * gate scheduling: every submitter continues straight to the calendar.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  const { token } = await params;
  const resolved = await requireLead(token);
  if ("response" in resolved) return resolved.response;
  const { lead } = resolved;

  const store = getStore();
  const base = `/p/${token}`;

  const videoProgress = await store.getVideoProgress(lead.id);
  const videoCompleted = Boolean(videoProgress?.completed) || Boolean(lead.video_completed_at);

  const existing = await store.getQuestionnaire(lead.id);
  if (existing) {
    return NextResponse.json({
      success: true,
      qualified: lead.qualification_result === "qualified",
      nextUrl: `${base}/schedule`,
      alreadySubmitted: true,
    });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = questionnaireSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid responses", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const answers = parsed.data as QuestionnaireInput;
  const now = new Date().toISOString();

  try {
    await store.createQuestionnaire({
      lead_id: lead.id,
      investment_timeline: answers.investmentTimeline,
      liquid_capital: answers.liquidCapital,
      net_worth: answers.netWorth,
      business_ownership: answers.businessOwnership,
      primary_interest: answers.primaryInterest,
      remaining_questions: answers.remainingQuestions,
      decision_criteria: answers.decisionCriteria,
      decision_participants: answers.decisionParticipants,
      accuracy_confirmed: answers.accuracyConfirmed,
    });

    const qualification = evaluateQualification(lead, answers, videoCompleted);

    await store.updateLead(lead.id, {
      questionnaire_started_at: lead.questionnaire_started_at ?? now,
      questionnaire_completed_at: now,
      qualification_score: qualification.score,
      qualification_result: qualification.result,
      qualification_reasons: qualification.reasons,
      ...(qualification.qualified ? { qualified_at: now } : {}),
      ...(statusRank(lead.status) < statusRank(qualification.result)
        ? { status: qualification.result }
        : {}),
    });

    await trackEvent(lead, "questionnaire_submitted", null);
    await trackEvent(
      lead,
      qualification.qualified ? "lead_qualified" : "lead_sent_to_review",
      { score: qualification.score },
    );

    // Every prospect proceeds directly to scheduling — the qualification
    // result is internal context for the advisor, not an approval gate.
    return NextResponse.json({
      success: true,
      qualified: qualification.qualified,
      nextUrl: `${base}/schedule`,
    });
  } catch (error) {
    console.error("[questionnaire] save failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Your responses could not be saved. Please check your connection and try again.",
      },
      { status: 500 },
    );
  }
}
