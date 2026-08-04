import { z } from "zod";
import {
  BUSINESS_OWNERSHIP_OPTIONS,
  DECISION_PARTICIPANT_OPTIONS,
  INVESTMENT_TIMELINES,
  LIQUID_CAPITAL_RANGES,
  NET_WORTH_RANGES,
} from "@/types/questionnaire";

function valuesOf<T extends readonly { value: string }[]>(options: T) {
  return options.map((o) => o.value) as [string, ...string[]];
}

export const questionnaireSchema = z.object({
  investmentTimeline: z.enum(valuesOf(INVESTMENT_TIMELINES)),
  liquidCapital: z.enum(valuesOf(LIQUID_CAPITAL_RANGES)),
  netWorth: z.enum(valuesOf(NET_WORTH_RANGES)),
  businessOwnership: z.enum(valuesOf(BUSINESS_OWNERSHIP_OPTIONS)),
  primaryInterest: z.string().trim().min(1, "Required").max(5000),
  remainingQuestions: z.string().trim().min(1, "Required").max(5000),
  decisionCriteria: z.string().trim().min(1, "Required").max(5000),
  decisionParticipants: z.enum(valuesOf(DECISION_PARTICIPANT_OPTIONS)),
  accuracyConfirmed: z.literal(true, {
    errorMap: () => ({ message: "Please confirm your information is accurate" }),
  }),
});

export type QuestionnairePayload = z.infer<typeof questionnaireSchema>;
