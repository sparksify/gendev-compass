/**
 * Ownership Profile — a self-directed, locally-persisted assessment that
 * helps an investor articulate what they're looking for in business
 * ownership. It does not qualify or score investors; it exists so
 * GenDev Compass can later personalize resources, FAQs, the advisor
 * dashboard, and AI chat around what each investor actually cares about.
 *
 * Follows the same "options array + derived union + Input/Record shape"
 * convention as types/questionnaire.ts.
 */

export const MOTIVATION_OPTIONS = [
  { value: "long-term-wealth", label: "Build long-term wealth" },
  { value: "replace-income", label: "Replace my current income" },
  { value: "passive-income", label: "Create passive or semi-passive income" },
  { value: "leave-corporate", label: "Leave corporate America" },
  { value: "family-business", label: "Build a family business" },
  { value: "diversify", label: "Diversify investments" },
  { value: "freedom", label: "Gain more freedom" },
] as const;

export const ACTIVITY_OPTIONS = [
  { value: "leading-team", label: "Leading a team" },
  { value: "sales-networking", label: "Sales & networking" },
  { value: "helping-customers", label: "Helping customers" },
  { value: "building-systems", label: "Building systems" },
  { value: "operations", label: "Operations" },
  { value: "financial-management", label: "Financial management" },
  { value: "marketing", label: "Marketing" },
  { value: "strategic-planning", label: "Strategic planning" },
] as const;

/** Section 2 is capped so the signal stays sharp rather than "everything". */
export const ACTIVITY_SELECTION_LIMIT = 3;

export const GROWTH_COMFORT_OPTIONS = [
  { value: "one-location", label: "One location" },
  { value: "a-few-locations", label: "A few locations" },
  { value: "regional-expansion", label: "Regional expansion" },
  { value: "large-organization", label: "Build a large organization" },
  { value: "not-sure", label: "Not sure yet" },
] as const;

export const ENVIRONMENT_OPTIONS = [
  { value: "healthcare", label: "Healthcare" },
  { value: "b2b-services", label: "B2B Services" },
  { value: "retail", label: "Retail" },
  { value: "home-services", label: "Home Services" },
  { value: "industrial", label: "Industrial" },
  { value: "education", label: "Education" },
  { value: "automotive", label: "Automotive" },
  { value: "food", label: "Food" },
  { value: "technology", label: "Technology" },
  { value: "professional-services", label: "Professional Services" },
] as const;

export const PRIORITY_OPTIONS = [
  { value: "recurring-revenue", label: "Recurring revenue" },
  { value: "lifestyle-flexibility", label: "Lifestyle flexibility" },
  { value: "scalability", label: "Scalability" },
  { value: "simple-operations", label: "Simple operations" },
  { value: "mission-driven", label: "Mission driven" },
  { value: "strong-brand", label: "Strong brand" },
  { value: "low-employee-count", label: "Low employee count" },
  { value: "large-protected-territory", label: "Large protected territory" },
  { value: "community-impact", label: "Community impact" },
  { value: "predictable-demand", label: "Predictable demand" },
] as const;

/** Section 6 asks for top priorities, not an exhaustive checklist. */
export const PRIORITY_SELECTION_LIMIT = 5;

export const EXPERIENCE_OPTIONS = [
  { value: "business-owner", label: "Business owner" },
  { value: "corporate-executive", label: "Corporate executive" },
  { value: "sales", label: "Sales" },
  { value: "operations", label: "Operations" },
  { value: "management", label: "Management" },
  { value: "military", label: "Military" },
  { value: "healthcare", label: "Healthcare" },
  { value: "finance", label: "Finance" },
  { value: "technology", label: "Technology" },
  { value: "construction", label: "Construction" },
  { value: "no-previous-ownership", label: "No previous ownership" },
] as const;

export const TIMELINE_OPTIONS = [
  { value: "just-researching", label: "Just researching" },
  { value: "next-6-months", label: "Next 6 months" },
  { value: "actively-evaluating", label: "Actively evaluating" },
  { value: "ready-to-buy-soon", label: "Ready to buy soon" },
] as const;

export type MotivationValue = (typeof MOTIVATION_OPTIONS)[number]["value"];
export type ActivityValue = (typeof ACTIVITY_OPTIONS)[number]["value"];
export type GrowthComfortValue = (typeof GROWTH_COMFORT_OPTIONS)[number]["value"];
export type EnvironmentValue = (typeof ENVIRONMENT_OPTIONS)[number]["value"];
export type PriorityValue = (typeof PRIORITY_OPTIONS)[number]["value"];
export type ExperienceValue = (typeof EXPERIENCE_OPTIONS)[number]["value"];
export type TimelineValue = (typeof TIMELINE_OPTIONS)[number]["value"];

/** 0 = fully hands-on, 100 = fully executive/absentee. */
export type OwnershipStyleScore = number;

export interface OwnershipProfileInput {
  motivations: MotivationValue[];
  activities: ActivityValue[];
  ownershipStyle: OwnershipStyleScore;
  growthComfort: GrowthComfortValue | null;
  environments: EnvironmentValue[];
  priorities: PriorityValue[];
  experience: ExperienceValue[];
  timeline: TimelineValue | null;
}

/** Persisted shape — Input plus bookkeeping for autosave/resume/completion. */
export interface OwnershipProfileRecord extends OwnershipProfileInput {
  /** Schema version, so a future shape change can migrate old localStorage entries. */
  version: 1;
  currentStep: number;
  updatedAt: string;
  completedAt: string | null;
}

export const EMPTY_OWNERSHIP_PROFILE: OwnershipProfileInput = {
  motivations: [],
  activities: [],
  ownershipStyle: 50,
  growthComfort: null,
  environments: [],
  priorities: [],
  experience: [],
  timeline: null,
};

export const OWNERSHIP_PROFILE_SECTION_COUNT = 8;

/**
 * Number of the 8 sections with at least one answer — used for the progress
 * bar and to decide where a returning investor should resume.
 */
export function countAnsweredSections(profile: OwnershipProfileInput): number {
  const answered = [
    profile.motivations.length > 0,
    profile.activities.length > 0,
    true, // ownership style always has a value (defaults to the midpoint)
    profile.growthComfort !== null,
    profile.environments.length > 0,
    profile.priorities.length > 0,
    profile.experience.length > 0,
    profile.timeline !== null,
  ];
  return answered.filter(Boolean).length;
}

function labelsFor<T extends string>(
  options: ReadonlyArray<{ value: T; label: string }>,
  values: T[],
): string[] {
  return values.map((value) => options.find((option) => option.value === value)?.label ?? value);
}

export function motivationLabels(profile: OwnershipProfileInput) {
  return labelsFor(MOTIVATION_OPTIONS, profile.motivations);
}
export function activityLabels(profile: OwnershipProfileInput) {
  return labelsFor(ACTIVITY_OPTIONS, profile.activities);
}
export function environmentLabels(profile: OwnershipProfileInput) {
  return labelsFor(ENVIRONMENT_OPTIONS, profile.environments);
}
export function priorityLabels(profile: OwnershipProfileInput) {
  return labelsFor(PRIORITY_OPTIONS, profile.priorities);
}
export function experienceLabels(profile: OwnershipProfileInput) {
  return labelsFor(EXPERIENCE_OPTIONS, profile.experience);
}
export function growthComfortLabel(profile: OwnershipProfileInput) {
  return GROWTH_COMFORT_OPTIONS.find((option) => option.value === profile.growthComfort)?.label ?? null;
}
export function timelineLabel(profile: OwnershipProfileInput) {
  return TIMELINE_OPTIONS.find((option) => option.value === profile.timeline)?.label ?? null;
}

/** Ownership style as a human label for the 0–100 slider score. */
export function ownershipStyleLabel(score: OwnershipStyleScore): string {
  if (score <= 15) return "Fully Hands-on Owner";
  if (score <= 40) return "Hands-on Owner";
  if (score <= 60) return "Balanced Owner";
  if (score <= 85) return "Executive Owner";
  return "Fully Executive Owner";
}
