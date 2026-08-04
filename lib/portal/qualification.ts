import type { LeadRecord, QualificationResultValue } from "@/types/lead";
import type { QuestionnaireInput } from "@/types/questionnaire";
import {
  DETAILED_ANSWER_MIN_LENGTH,
  DISQUALIFYING_TIMELINES,
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

  // Hard gate (spec §13): video + questionnaire + capital minimum + timeline.
  const qualified = videoCompleted && capitalMeetsMinimum && timelineAcceptable;

  reasons.push(`Score ${score} (threshold ${getScoreThreshold()})`);

  return {
    qualified,
    result: qualified ? "qualified" : "review_required",
    score,
    reasons,
  };
}
