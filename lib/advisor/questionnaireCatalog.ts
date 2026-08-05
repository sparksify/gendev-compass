import {
  BUSINESS_OWNERSHIP_OPTIONS,
  DECISION_PARTICIPANT_OPTIONS,
  INVESTMENT_TIMELINES,
  LIQUID_CAPITAL_RANGES,
  NET_WORTH_RANGES,
  type QuestionnaireInput,
} from "@/types/questionnaire";

/**
 * Versioned catalog of the questionnaire as presented to the prospect.
 * Bump QUESTIONNAIRE_VERSION whenever question wording or options change so
 * stored submissions keep the exact text that was asked at the time.
 */
export const QUESTIONNAIRE_VERSION = "1.0";

type OptionList = ReadonlyArray<{ value: string; label: string }>;

function displayValue(options: OptionList, value: string): string {
  return options.find((o) => o.value === value)?.label ?? value;
}

export interface CatalogAnswer {
  question_key: string;
  question_text: string;
  answer_value: string;
  answer_display_value: string;
}

/** Snapshot of every question and answer for immutable storage. */
export function buildAnswerSnapshot(answers: QuestionnaireInput): CatalogAnswer[] {
  return [
    {
      question_key: "investmentTimeline",
      question_text: "What is your investment timeline?",
      answer_value: answers.investmentTimeline,
      answer_display_value: displayValue(INVESTMENT_TIMELINES, answers.investmentTimeline),
    },
    {
      question_key: "liquidCapital",
      question_text: "How much liquid capital do you have available to invest?",
      answer_value: answers.liquidCapital,
      answer_display_value: displayValue(LIQUID_CAPITAL_RANGES, answers.liquidCapital),
    },
    {
      question_key: "netWorth",
      question_text: "What is your estimated total net worth?",
      answer_value: answers.netWorth,
      answer_display_value: displayValue(NET_WORTH_RANGES, answers.netWorth),
    },
    {
      question_key: "businessOwnership",
      question_text: "Have you owned a business before?",
      answer_value: answers.businessOwnership,
      answer_display_value: displayValue(BUSINESS_OWNERSHIP_OPTIONS, answers.businessOwnership),
    },
    {
      question_key: "primaryInterest",
      question_text: "What interested you most about this opportunity?",
      answer_value: answers.primaryInterest,
      answer_display_value: answers.primaryInterest,
    },
    {
      question_key: "remainingQuestions",
      question_text: "What questions do you want answered during your consultation?",
      answer_value: answers.remainingQuestions,
      answer_display_value: answers.remainingQuestions,
    },
    {
      question_key: "decisionCriteria",
      question_text: "What criteria will drive your investment decision?",
      answer_value: answers.decisionCriteria,
      answer_display_value: answers.decisionCriteria,
    },
    {
      question_key: "decisionParticipants",
      question_text: "Who participates in your investment decision?",
      answer_value: answers.decisionParticipants,
      answer_display_value: displayValue(DECISION_PARTICIPANT_OPTIONS, answers.decisionParticipants),
    },
    {
      question_key: "accuracyConfirmed",
      question_text: "I confirm the information provided is accurate.",
      answer_value: String(answers.accuracyConfirmed),
      answer_display_value: answers.accuracyConfirmed ? "Yes" : "No",
    },
  ];
}

/** Display label for a stored range value (used in list/detail pages). */
export function labelForValue(value: string | null | undefined): string {
  if (!value) return "—";
  const all: OptionList = [
    ...INVESTMENT_TIMELINES,
    ...LIQUID_CAPITAL_RANGES,
    ...NET_WORTH_RANGES,
    ...BUSINESS_OWNERSHIP_OPTIONS,
    ...DECISION_PARTICIPANT_OPTIONS,
  ];
  return all.find((o) => o.value === value)?.label ?? value;
}
