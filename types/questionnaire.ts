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
}
