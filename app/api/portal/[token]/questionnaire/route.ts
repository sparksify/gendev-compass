import { NextResponse } from "next/server";
import { requireLead } from "@/lib/portal/api";
import { getStore } from "@/lib/store";
import { statusRank } from "@/lib/store/types";
import { trackEvent } from "@/lib/portal/events";
import { evaluateQualification } from "@/lib/portal/qualification";
import { financingDetailsApply, questionnaireSchema } from "@/lib/validation/questionnaire";
import { autoAdvanceStage } from "@/lib/advisor/stages";
import { buildAnswerSnapshot, QUESTIONNAIRE_VERSION } from "@/lib/advisor/questionnaireCatalog";
import { ensureLeadDomainChain, type LeadDomainChain } from "@/lib/domain/chain";
import { syncPrimaryOpportunityQualification } from "@/lib/domain/opportunities";
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

  // Attach the submission to the lead's opportunity chain (repairing it on
  // demand); a chain failure never blocks the prospect.
  let chain: LeadDomainChain | null = null;
  try {
    chain = await ensureLeadDomainChain(lead);
  } catch (error) {
    console.error(`[questionnaire] chain resolution failed for lead ${lead.id}:`, error);
  }

  try {
    // Financing-dependent answers only exist when financing may be in play;
    // funding_followup_requested is the internal workflow flag (spec §5).
    const financingDetails = financingDetailsApply(answers.financingNeed);
    const fundingFollowupRequested =
      financingDetails && answers.fundingAssistanceRequested === "yes";

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
      opportunity_id: chain?.opportunity.id ?? null,
      address_line_1: answers.addressLine1,
      address_line_2: answers.addressLine2 ?? null,
      city: answers.city,
      state: answers.state,
      postal_code: answers.postalCode,
      country: answers.country,
      estimated_credit_score_range: answers.estimatedCreditScoreRange,
      anticipated_funding_sources: answers.anticipatedFundingSources,
      financing_need: answers.financingNeed,
      preferred_financing_percentage: financingDetails
        ? (answers.preferredFinancingPercentage ?? null)
        : null,
      available_cash_contribution: answers.availableCashContribution,
      lender_status: financingDetails ? (answers.lenderStatus ?? null) : null,
      funding_assistance_requested: financingDetails
        ? (answers.fundingAssistanceRequested ?? null)
        : null,
      funding_followup_requested: fundingFollowupRequested,
      existing_business_entity: answers.existingBusinessEntity,
      prior_business_financing_experience: answers.priorBusinessFinancingExperience,
    });

    const qualification = evaluateQualification(lead, answers, videoCompleted);

    const updatedLead = await store.updateLead(lead.id, {
      questionnaire_started_at: lead.questionnaire_started_at ?? now,
      questionnaire_completed_at: now,
      // The validated payload is now canonical — drop the autosaved draft.
      questionnaire_draft: null,
      questionnaire_draft_saved_at: null,
      qualification_score: qualification.score,
      qualification_result: qualification.result,
      qualification_reasons: qualification.reasons,
      last_activity_at: now,
      ...(qualification.qualified ? { qualified_at: now } : {}),
      ...(statusRank(lead.status) < statusRank(qualification.result)
        ? { status: qualification.result }
        : {}),
    });
    await syncPrimaryOpportunityQualification(updatedLead);

    // Immutable, versioned snapshot for the advisor backend: exactly what
    // was asked and answered, preserved even if wording changes later.
    await store.createSubmission({
      lead_id: lead.id,
      questionnaire_version: QUESTIONNAIRE_VERSION,
      submitted_at: now,
      answers: buildAnswerSnapshot(answers),
      organization_id: chain?.organization.id ?? null,
      client_id: chain?.client.id ?? null,
      opportunity_id: chain?.opportunity.id ?? null,
      brand_id: chain?.brand.id ?? null,
    });

    await autoAdvanceStage(lead, "QUESTIONNAIRE_COMPLETED", "portal");

    // `updatedLead` rather than `lead`: the advisor notification renders the
    // qualification result and score, which only exist after the update
    // above. The version scopes the notification's idempotency key, so a
    // genuinely new questionnaire version can notify again. The returned
    // tracking payloads are threaded to the client so the browser fires
    // dataLayer/Pixel with the same dedup event IDs.
    const submittedTracking = await trackEvent(updatedLead, "questionnaire_submitted", {
      questionnaireVersion: QUESTIONNAIRE_VERSION,
    });
    const qualificationTracking = await trackEvent(
      updatedLead,
      qualification.qualified ? "lead_qualified" : "lead_sent_to_review",
      { score: qualification.score },
      null,
      // Tier 2 conversion (spec §8) — the business cares about qualified
      // volume, not raw submissions. Only a coarse boolean ever leaves the
      // portal; the score/reasons stay in Supabase.
      qualification.qualified
        ? { meta: { customData: { qualification_status: "qualified" } } }
        : {},
    );
    // Workflow signal only — never the underlying financial answers.
    if (fundingFollowupRequested) {
      await trackEvent(lead, "funding_assistance_requested", null);
    }

    // Every prospect proceeds directly to scheduling — the qualification
    // result is internal context for the advisor, not an approval gate.
    return NextResponse.json({
      success: true,
      qualified: qualification.qualified,
      nextUrl: `${base}/schedule`,
      tracking: [
        { eventId: submittedTracking.eventId, dataLayerPayload: submittedTracking.dataLayerPayload, metaPixelBrowser: submittedTracking.metaPixelBrowser },
        { eventId: qualificationTracking.eventId, dataLayerPayload: qualificationTracking.dataLayerPayload, metaPixelBrowser: qualificationTracking.metaPixelBrowser },
      ],
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
