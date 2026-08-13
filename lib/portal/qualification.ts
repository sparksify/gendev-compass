import type { LeadRecord, QualificationResultValue } from "@/types/lead";
import type { QuestionnaireInput } from "@/types/questionnaire";
import {
  CASH_CONTRIBUTION_WEIGHTS,
  CREDIT_PROFILE_WEIGHTS,
  DETAILED_ANSWER_MIN_LENGTH,
  DISQUALIFYING_TIMELINES,
  LENDER_STATUS_WEIGHTS,
  LIQUID_CAPITAL_ORDER,
  MIN_QUALIFYING_LIQUID_CAPITAL,
  SCORE_WEIGHTS,
  getScoreThreshold,
} from "@/lib/config/qualification";

export interface QualificationResult {
  qualified: boolean;
  result: QualificationResultValue;
  score: number;
  /** Internal-only. Never shown to the prospect. */
  reasons: string[];
}

/**
 * Server-side qualification. Pure function of the lead + questionnaire so it
 * can be unit-tested and re-run if rules change. Client-reported state is
 * never trusted: `videoCompleted` must come from the server-tracked record.
 */
export function evaluateQualification(
  lead: LeadRecord,
  questionnaire: QuestionnaireInput,
  videoCompleted: boolean,
): QualificationResult {
  const reasons: string[] = [];
  let score = 0;

  if (videoCompleted) {
    score += SCORE_WEIGHTS.videoCompleted;
    reasons.push("Video completed");
  } else {
    reasons.push("Video not completed");
  }

  const capitalRank = LIQUID_CAPITAL_ORDER.indexOf(questionnaire.liquidCapital);
  const minCapitalRank = LIQUID_CAPITAL_ORDER.indexOf(MIN_QUALIFYING_LIQUID_CAPITAL);
  const capitalMeetsMinimum = capitalRank >= minCapitalRank;
  score += SCORE_WEIGHTS.liquidCapital[questionnaire.liquidCapital] ?? 0;
  reasons.push(
    capitalMeetsMinimum ? "Liquid capital meets minimum" : "Liquid capital below minimum",
  );

  const timelineAcceptable = !DISQUALIFYING_TIMELINES.includes(questionnaire.investmentTimeline);
  score += SCORE_WEIGHTS.timeline[questionnaire.investmentTimeline] ?? 0;
  reasons.push(
    timelineAcceptable
      ? `Investment timeline: ${questionnaire.investmentTimeline}`
      : "Investment timeline is research-only",
  );

  const ownershipScore = SCORE_WEIGHTS.businessOwnership[questionnaire.businessOwnership] ?? 0;
  score += ownershipScore;
  if (ownershipScore > 0) {
    reasons.push(`Business ownership: ${questionnaire.businessOwnership}`);
  }

  const detailedAnswers = [
    questionnaire.primaryInterest,
    questionnaire.remainingQuestions,
    questionnaire.decisionCriteria,
  ].some((answer) => answer.trim().length >= DETAILED_ANSWER_MIN_LENGTH);
  if (detailedAnswers) {
    score += SCORE_WEIGHTS.detailedAnswers;
    reasons.push("Detailed question submitted");
  }

  // Hard gate: questionnaire + capital minimum + timeline. The investor
  // overview is an educational path, not a qualification requirement —
  // experienced investors may fast-track directly to the questionnaire.
  // Video completion still contributes to the informational score above.
  const qualified = capitalMeetsMinimum && timelineAcceptable;

  // Informational readiness scores (v1.1) — advisor context only, never a
  // gate. Self-reported credit and financing need do not disqualify anyone.
  const readiness = fundingReadinessProfile(questionnaire);
  if (readiness.creditProfileScore !== null) {
    reasons.push(`Credit profile score ${readiness.creditProfileScore} (self-reported, unverified)`);
  }
  if (readiness.fundingReadinessScore !== null) {
    reasons.push(`Funding readiness score ${readiness.fundingReadinessScore}`);
  }
  if (readiness.capitalReadinessScore !== null) {
    reasons.push(`Capital readiness score ${readiness.capitalReadinessScore}`);
  }

  reasons.push(`Score ${score} (threshold ${getScoreThreshold()})`);

  return {
    qualified,
    result: qualified ? "qualified" : "review_required",
    score,
    reasons,
  };
}

export interface FundingReadinessProfile {
  creditProfileScore: number | null;
  fundingReadinessScore: number | null;
  capitalReadinessScore: number | null;
}

/**
 * Future-ready scoring hooks (spec §10): pure, brand-neutral readiness
 * signals derived from the credit & funding answers. Currently surfaced to
 * advisors via qualification reasons; brand-specific rule sets may consume
 * them later. Null when the underlying answer wasn't collected (pre-v1.1
 * records or conditionally hidden questions).
 */
export function fundingReadinessProfile(
  questionnaire: Pick<
    QuestionnaireInput,
    "estimatedCreditScoreRange" | "financingNeed" | "lenderStatus" | "availableCashContribution"
  >,
): FundingReadinessProfile {
  const creditProfileScore =
    CREDIT_PROFILE_WEIGHTS[questionnaire.estimatedCreditScoreRange] ?? null;

  // Candidates funding without financing are fully funding-ready by definition.
  const fundingReadinessScore =
    questionnaire.financingNeed === "no"
      ? 100
      : questionnaire.lenderStatus
        ? (LENDER_STATUS_WEIGHTS[questionnaire.lenderStatus] ?? null)
        : null;

  const capitalReadinessScore =
    CASH_CONTRIBUTION_WEIGHTS[questionnaire.availableCashContribution] ?? null;

  return { creditProfileScore, fundingReadinessScore, capitalReadinessScore };
}
