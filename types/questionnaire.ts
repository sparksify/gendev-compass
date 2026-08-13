export const INVESTMENT_TIMELINES = [
  { value: "immediately", label: "Immediately" },
  { value: "within-30-days", label: "Within 30 days" },
  { value: "within-90-days", label: "Within 90 days" },
  { value: "within-6-months", label: "Within 6 months" },
  { value: "researching", label: "Researching for the future" },
] as const;

export const LIQUID_CAPITAL_RANGES = [
  { value: "lt-100k", label: "Less than $100,000" },
  { value: "100k-249k", label: "$100,000–$249,999" },
  { value: "250k-499k", label: "$250,000–$499,999" },
  { value: "500k-999k", label: "$500,000–$999,999" },
  { value: "1m-2.4m", label: "$1,000,000–$2,499,999" },
  { value: "2.5m-plus", label: "$2,500,000+" },
] as const;

export const NET_WORTH_RANGES = [
  { value: "lt-500k", label: "Less than $500,000" },
  { value: "500k-999k", label: "$500,000–$999,999" },
  { value: "1m-2.4m", label: "$1,000,000–$2,499,999" },
  { value: "2.5m-4.9m", label: "$2,500,000–$4,999,999" },
  { value: "5m-plus", label: "$5,000,000+" },
] as const;

export const BUSINESS_OWNERSHIP_OPTIONS = [
  { value: "yes-currently", label: "Yes, currently" },
  { value: "yes-previously", label: "Yes, previously" },
  { value: "no", label: "No" },
] as const;

export const DECISION_PARTICIPANT_OPTIONS = [
  { value: "independent", label: "I make the decision independently" },
  { value: "spouse", label: "Spouse or partner" },
  { value: "business-partner", label: "Business partner" },
  { value: "financial-advisor", label: "Financial advisor" },
  { value: "other", label: "Other" },
] as const;

export type InvestmentTimeline = (typeof INVESTMENT_TIMELINES)[number]["value"];
export type LiquidCapitalRange = (typeof LIQUID_CAPITAL_RANGES)[number]["value"];
export type NetWorthRange = (typeof NET_WORTH_RANGES)[number]["value"];
export type BusinessOwnership = (typeof BUSINESS_OWNERSHIP_OPTIONS)[number]["value"];
export type DecisionParticipants = (typeof DECISION_PARTICIPANT_OPTIONS)[number]["value"];

export interface QuestionnaireInput {
  investmentTimeline: InvestmentTimeline;
  liquidCapital: LiquidCapitalRange;
  netWorth: NetWorthRange;
  businessOwnership: BusinessOwnership;
  primaryInterest: string;
  remainingQuestions: string;
  decisionCriteria: string;
  decisionParticipants: DecisionParticipants;
  accuracyConfirmed: boolean;
  // Location (v1.1)
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  // Credit & funding (v1.1). The financing-dependent answers are absent
  // when financingNeed === "no" (conditional section).
  estimatedCreditScoreRange: CreditScoreRange;
  anticipatedFundingSources: FundingSource[];
  financingNeed: FinancingNeed;
  preferredFinancingPercentage?: FinancingPercentage;
  lenderStatus?: LenderStatus;
  fundingAssistanceRequested?: FundingAssistance;
  availableCashContribution: CashContributionRange;
  existingBusinessEntity: ExistingEntity;
  priorBusinessFinancingExperience: PriorFinancingExperience;
}

export interface QuestionnaireRecord {
  id: string;
  lead_id: string;
  investment_timeline: string;
  liquid_capital: string;
  net_worth: string;
  business_ownership: string;
  primary_interest: string;
  remaining_questions: string;
  decision_criteria: string;
  decision_participants: string;
  accuracy_confirmed: boolean;
  created_at: string;
  updated_at: string;
  /** Platform domain link (nullable during the transition). */
  opportunity_id: string | null;
  // Location (v1.1) — null for records created before the fields existed.
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  // Credit & funding (v1.1) — null for pre-v1.1 records and for
  // financing-dependent answers hidden by the conditional section.
  estimated_credit_score_range: string | null;
  anticipated_funding_sources: string[] | null;
  financing_need: string | null;
  preferred_financing_percentage: string | null;
  available_cash_contribution: string | null;
  lender_status: string | null;
  funding_assistance_requested: string | null;
  funding_followup_requested: boolean;
  existing_business_entity: string | null;
  prior_business_financing_experience: string | null;
}

// ---------------------------------------------------------------------------
// Location, credit & funding qualification (questionnaire v1.1).
// Option values are brand-neutral; brand-specific thresholds belong in
// qualification configuration, never in these reusable lists.
// ---------------------------------------------------------------------------

export const CREDIT_SCORE_RANGES = [
  { value: "760-plus", label: "760+" },
  { value: "720-759", label: "720–759" },
  { value: "680-719", label: "680–719" },
  { value: "640-679", label: "640–679" },
  { value: "600-639", label: "600–639" },
  { value: "below-600", label: "Below 600" },
  { value: "not-sure", label: "Not Sure" },
  { value: "prefer-not-to-say", label: "Prefer Not to Say" },
] as const;

export const FUNDING_SOURCE_OPTIONS = [
  { value: "cash", label: "Cash / liquid assets" },
  { value: "business-funds", label: "Business funds" },
  { value: "traditional-financing", label: "Traditional financing" },
  { value: "sba-financing", label: "SBA financing" },
  { value: "home-equity", label: "Home equity" },
  { value: "retirement-robs", label: "Retirement funds / ROBS" },
  { value: "investment-partner", label: "Investment partner" },
  { value: "cash-financing-combo", label: "Combination of cash and financing" },
  { value: "not-sure", label: "Not sure yet" },
  { value: "other", label: "Other" },
] as const;

export const FINANCING_NEED_OPTIONS = [
  { value: "no", label: "No — I expect to fund the investment without financing" },
  { value: "possibly", label: "Possibly — I may use some financing" },
  { value: "yes", label: "Yes — financing will likely be required" },
  { value: "not-sure", label: "Not sure yet" },
] as const;

export const FINANCING_PERCENTAGE_OPTIONS = [
  { value: "none", label: "None" },
  { value: "lt-25", label: "Less than 25%" },
  { value: "25-49", label: "25%–49%" },
  { value: "50-74", label: "50%–74%" },
  { value: "75-plus", label: "75%+" },
  { value: "not-sure", label: "Not sure yet" },
] as const;

export const CASH_CONTRIBUTION_RANGES = [
  { value: "lt-50k", label: "Less than $50,000" },
  { value: "50k-99k", label: "$50,000–$99,999" },
  { value: "100k-149k", label: "$100,000–$149,999" },
  { value: "150k-249k", label: "$150,000–$249,999" },
  { value: "250k-499k", label: "$250,000–$499,999" },
  { value: "500k-plus", label: "$500,000+" },
  { value: "prefer-not-to-say", label: "Prefer not to say" },
] as const;

export const LENDER_STATUS_OPTIONS = [
  { value: "prequalified", label: "Yes — I am prequalified or preapproved" },
  { value: "initial-conversation", label: "Yes — I have had an initial conversation" },
  { value: "no", label: "No" },
  { value: "want-introduction", label: "Not yet, but I would like an introduction" },
] as const;

export const FUNDING_ASSISTANCE_OPTIONS = [
  { value: "yes", label: "Yes" },
  { value: "possibly", label: "Possibly" },
  { value: "no", label: "No" },
] as const;

export const EXISTING_ENTITY_OPTIONS = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "forming", label: "In the process of forming one" },
] as const;

export const PRIOR_FINANCING_EXPERIENCE_OPTIONS = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "not-sure", label: "Not sure" },
] as const;

export type CreditScoreRange = (typeof CREDIT_SCORE_RANGES)[number]["value"];
export type FundingSource = (typeof FUNDING_SOURCE_OPTIONS)[number]["value"];
export type FinancingNeed = (typeof FINANCING_NEED_OPTIONS)[number]["value"];
export type FinancingPercentage = (typeof FINANCING_PERCENTAGE_OPTIONS)[number]["value"];
export type CashContributionRange = (typeof CASH_CONTRIBUTION_RANGES)[number]["value"];
export type LenderStatus = (typeof LENDER_STATUS_OPTIONS)[number]["value"];
export type FundingAssistance = (typeof FUNDING_ASSISTANCE_OPTIONS)[number]["value"];
export type ExistingEntity = (typeof EXISTING_ENTITY_OPTIONS)[number]["value"];
export type PriorFinancingExperience = (typeof PRIOR_FINANCING_EXPERIENCE_OPTIONS)[number]["value"];
