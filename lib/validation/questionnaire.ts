import { z } from "zod";
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
} from "@/types/questionnaire";
import { COUNTRY_OPTIONS, US_STATE_CODES, US_ZIP_PATTERN } from "@/types/address";

function valuesOf<T extends readonly { value: string }[]>(options: T) {
  return options.map((o) => o.value) as [string, ...string[]];
}

/**
 * Whether the financing-dependent questions (preferred percentage, lender
 * status, funding assistance) apply for a given financing-need answer.
 * "no" hides them; every other answer shows the full funding subsection.
 */
export function financingDetailsApply(financingNeed: string | undefined): boolean {
  return financingNeed !== undefined && financingNeed !== "no";
}

export const questionnaireSchema = z
  .object({
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

    // Location. State/postal stay free-text at the schema level so
    // international addresses remain representable; U.S.-specific format
    // rules are enforced in the refinement below.
    addressLine1: z.string().trim().min(1, "Street address is required").max(200),
    addressLine2: z
      .string()
      .trim()
      .max(200)
      .optional()
      .transform((value) => (value ? value : undefined)),
    city: z.string().trim().min(1, "City is required").max(100),
    state: z.string().trim().min(1, "State / province is required").max(100),
    postalCode: z.string().trim().min(1, "ZIP / postal code is required").max(20),
    country: z.enum(valuesOf(COUNTRY_OPTIONS), {
      errorMap: () => ({ message: "Country is required" }),
    }),

    // Credit & funding.
    estimatedCreditScoreRange: z.enum(valuesOf(CREDIT_SCORE_RANGES), {
      errorMap: () => ({ message: "Please select an option" }),
    }),
    anticipatedFundingSources: z
      .array(z.enum(valuesOf(FUNDING_SOURCE_OPTIONS)))
      .min(1, "Select at least one funding source")
      .max(FUNDING_SOURCE_OPTIONS.length),
    financingNeed: z.enum(valuesOf(FINANCING_NEED_OPTIONS), {
      errorMap: () => ({ message: "Please select an option" }),
    }),
    preferredFinancingPercentage: z.enum(valuesOf(FINANCING_PERCENTAGE_OPTIONS)).optional(),
    lenderStatus: z.enum(valuesOf(LENDER_STATUS_OPTIONS)).optional(),
    fundingAssistanceRequested: z.enum(valuesOf(FUNDING_ASSISTANCE_OPTIONS)).optional(),
    availableCashContribution: z.enum(valuesOf(CASH_CONTRIBUTION_RANGES), {
      errorMap: () => ({ message: "Please select an option" }),
    }),
    existingBusinessEntity: z.enum(valuesOf(EXISTING_ENTITY_OPTIONS), {
      errorMap: () => ({ message: "Please select an option" }),
    }),
    priorBusinessFinancingExperience: z.enum(valuesOf(PRIOR_FINANCING_EXPERIENCE_OPTIONS), {
      errorMap: () => ({ message: "Please select an option" }),
    }),
  })
  .superRefine((values, ctx) => {
    // U.S. addresses: state must be a real state code, ZIP must be 5 or 5+4.
    if (values.country === "United States") {
      if (!US_STATE_CODES.has(values.state)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["state"],
          message: "Please select a state",
        });
      }
      if (!US_ZIP_PATTERN.test(values.postalCode)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["postalCode"],
          message: "Enter a valid ZIP code (e.g. 75201 or 75201-1234)",
        });
      }
    }

    // Financing-dependent questions are required whenever financing may be
    // in play, and must be absent when it is explicitly not needed.
    if (financingDetailsApply(values.financingNeed)) {
      if (!values.preferredFinancingPercentage) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["preferredFinancingPercentage"],
          message: "Please select an option",
        });
      }
      if (!values.lenderStatus) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["lenderStatus"],
          message: "Please select an option",
        });
      }
      if (!values.fundingAssistanceRequested) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["fundingAssistanceRequested"],
          message: "Please select an option",
        });
      }
    }
  });

export type QuestionnairePayload = z.infer<typeof questionnaireSchema>;
