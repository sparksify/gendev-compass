import {
  BUSINESS_OWNERSHIP_OPTIONS,
  CASH_CONTRIBUTION_RANGES,
  CREDIT_SCORE_RANGES,
  DECISION_PARTICIPANT_OPTIONS,
  EXISTING_ENTITY_OPTIONS,
  FINANCING_NEED_OPTIONS,
  FINANCING_PERCENTAGE_OPTIONS,
  FUNDING_ASSISTANCE_OPTIONS,
  FUNDING_SOURCE_OPTIONS,
  INVESTMENT_TIMELINES,
  LENDER_STATUS_OPTIONS,
  LIQUID_CAPITAL_RANGES,
  NET_WORTH_RANGES,
  PRIOR_FINANCING_EXPERIENCE_OPTIONS,
  type QuestionnaireInput,
} from "@/types/questionnaire";

/**
 * Versioned catalog of the questionnaire as presented to the prospect.
 * Bump QUESTIONNAIRE_VERSION whenever question wording or options change so
 * stored submissions keep the exact text that was asked at the time.
 */
export const QUESTIONNAIRE_VERSION = "1.1";

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
      question_key: "mailingAddress",
      question_text: "What is your physical mailing address?",
      answer_value: [
        answers.addressLine1,
        answers.addressLine2,
        answers.city,
        answers.state,
        answers.postalCode,
        answers.country,
      ]
        .filter(Boolean)
        .join(", "),
      answer_display_value: [
        answers.addressLine1,
        answers.addressLine2,
        `${answers.city}, ${answers.state} ${answers.postalCode}`,
        answers.country,
      ]
        .filter(Boolean)
        .join(", "),
    },
    {
      question_key: "estimatedCreditScoreRange",
      question_text: "What is your estimated personal credit score? (self-reported, unverified)",
      answer_value: answers.estimatedCreditScoreRange,
      answer_display_value: displayValue(CREDIT_SCORE_RANGES, answers.estimatedCreditScoreRange),
    },
    {
      question_key: "anticipatedFundingSources",
      question_text: "How do you expect to fund the investment?",
      answer_value: answers.anticipatedFundingSources.join(","),
      answer_display_value: answers.anticipatedFundingSources
        .map((source) => displayValue(FUNDING_SOURCE_OPTIONS, source))
        .join("; "),
    },
    {
      question_key: "financingNeed",
      question_text: "Will you likely need financing to complete the investment?",
      answer_value: answers.financingNeed,
      answer_display_value: displayValue(FINANCING_NEED_OPTIONS, answers.financingNeed),
    },
    {
      question_key: "preferredFinancingPercentage",
      question_text: "Approximately how much of the investment would you prefer to finance?",
      answer_value: answers.preferredFinancingPercentage ?? "",
      answer_display_value: answers.preferredFinancingPercentage
        ? displayValue(FINANCING_PERCENTAGE_OPTIONS, answers.preferredFinancingPercentage)
        : "Not asked (no financing expected)",
    },
    {
      question_key: "availableCashContribution",
      question_text:
        "How much cash or liquid capital would you be comfortable contributing toward the investment?",
      answer_value: answers.availableCashContribution,
      answer_display_value: displayValue(
        CASH_CONTRIBUTION_RANGES,
        answers.availableCashContribution,
      ),
    },
    {
      question_key: "lenderStatus",
      question_text: "Have you already spoken with a lender or funding provider?",
      answer_value: answers.lenderStatus ?? "",
      answer_display_value: answers.lenderStatus
        ? displayValue(LENDER_STATUS_OPTIONS, answers.lenderStatus)
        : "Not asked (no financing expected)",
    },
    {
      question_key: "fundingAssistanceRequested",
      question_text: "Would you like help exploring financing options?",
      answer_value: answers.fundingAssistanceRequested ?? "",
      answer_display_value: answers.fundingAssistanceRequested
        ? displayValue(FUNDING_ASSISTANCE_OPTIONS, answers.fundingAssistanceRequested)
        : "Not asked (no financing expected)",
    },
    {
      question_key: "existingBusinessEntity",
      question_text: "Do you currently have an existing business entity?",
      answer_value: answers.existingBusinessEntity,
      answer_display_value: displayValue(EXISTING_ENTITY_OPTIONS, answers.existingBusinessEntity),
    },
    {
      question_key: "priorBusinessFinancingExperience",
      question_text: "Have you used SBA or commercial financing before?",
      answer_value: answers.priorBusinessFinancingExperience,
      answer_display_value: displayValue(
        PRIOR_FINANCING_EXPERIENCE_OPTIONS,
        answers.priorBusinessFinancingExperience,
      ),
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
    ...CREDIT_SCORE_RANGES,
    ...FUNDING_SOURCE_OPTIONS,
    ...FINANCING_NEED_OPTIONS,
    ...FINANCING_PERCENTAGE_OPTIONS,
    ...CASH_CONTRIBUTION_RANGES,
    ...LENDER_STATUS_OPTIONS,
    ...FUNDING_ASSISTANCE_OPTIONS,
    ...EXISTING_ENTITY_OPTIONS,
    ...PRIOR_FINANCING_EXPERIENCE_OPTIONS,
  ];
  return all.find((o) => o.value === value)?.label ?? value;
}

/**
 * Display label resolved against a specific option list. Prefer this over
 * labelForValue for v1.1 fields: values like "no" / "not-sure" repeat across
 * the credit & funding lists, so a global first-match lookup is ambiguous.
 */
export function labelIn(
  options: OptionList,
  value: string | null | undefined,
): string {
  if (!value) return "Not Provided";
  return options.find((o) => o.value === value)?.label ?? value;
}
