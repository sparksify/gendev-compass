import { z } from "zod";
import { LIQUID_CAPITAL_RANGES } from "@/types/questionnaire";
import { LIQUID_CAPITAL_ORDER, MIN_QUALIFYING_LIQUID_CAPITAL } from "@/lib/config/qualification";
import { US_STATES } from "@/lib/geocoding/states";

/**
 * The bridge page's fit assessment: the seven quick questions a prospect
 * answers before entering GenDev Compass, plus the contact step that turns
 * the answers into a lead. Shared by the client flow (rendering, inline
 * validation) and the API route (server validation, fit call), so the two
 * can never disagree about what a valid submission looks like.
 *
 * Option values are stable identifiers — they are stored on the lead's
 * event history, so renaming a label must never change its value.
 */

export const BRIDGE_ASSESSMENT_VERSION = "bridge-fit-v1";

export const GOAL_OPTIONS = [
  { value: "replace-income", label: "Replace my current income and become a full-time owner" },
  { value: "additional-income", label: "Build an additional source of income" },
  { value: "portfolio", label: "Add another business to my portfolio" },
  { value: "team-managed", label: "Create something I can eventually manage through a team" },
  { value: "control", label: "Gain more control over my time and career" },
  { value: "figuring-out", label: "I’m still figuring that out" },
] as const;

export const ROLE_OPTIONS = [
  { value: "hands-on", label: "I want to be actively involved day to day" },
  { value: "lead-team", label: "I want to build the business and lead a small team" },
  { value: "manager-run", label: "I ultimately want a manager/team handling more of the daily operation" },
  { value: "open", label: "I’m open to different models" },
  { value: "not-sure", label: "I’m not sure yet" },
] as const;

export const TIMELINE_OPTIONS = [
  { value: "asap", label: "As soon as I find the right opportunity" },
  { value: "within-3-months", label: "Within 3 months" },
  { value: "3-6-months", label: "3–6 months" },
  { value: "6-12-months", label: "6–12 months" },
  { value: "12-plus-months", label: "More than 12 months from now" },
  { value: "researching", label: "I’m just researching right now" },
] as const;

/**
 * Comfortable total-investment ranges. PLACEHOLDER — these are illustrative
 * brackets and must be replaced with the ranges from the brand's current
 * offering (Item 7 of the FDD) before the page goes live.
 */
export const INVESTMENT_LEVEL_OPTIONS = [
  { value: "lt-75k", label: "Under $75,000" },
  { value: "75k-125k", label: "$75,000–$125,000" },
  { value: "125k-200k", label: "$125,000–$200,000" },
  { value: "200k-300k-plus", label: "$200,000–$300,000+" },
  { value: "not-sure", label: "I’m not sure yet" },
] as const;

/**
 * Liquid capital uses the portal questionnaire's own ranges so the bridge
 * answer lines up with the qualification rules in lib/config/qualification
 * and can be carried onto the lead as initial_liquid_capital.
 */
export const LIQUID_CAPITAL_OPTIONS = [
  ...LIQUID_CAPITAL_RANGES,
  { value: "prefer-private", label: "Prefer to discuss this privately" },
] as const;

export const PRIORITY_OPTIONS = [
  { value: "generate-business", label: "How owners generate business" },
  { value: "day-to-day", label: "What day-to-day ownership looks like" },
  { value: "investment-costs", label: "Investment and startup costs" },
  { value: "territory", label: "Territory availability" },
  { value: "training-support", label: "Training and support" },
  { value: "staffing-operations", label: "Staffing and operations" },
  { value: "growth", label: "Growth potential" },
  { value: "something-else", label: "Something else" },
] as const;

type OptionList = ReadonlyArray<{ readonly value: string; readonly label: string }>;

function enumOf<T extends OptionList>(options: T) {
  const values = options.map((o) => o.value) as [T[number]["value"], ...T[number]["value"][]];
  return z.enum(values);
}

const STATE_CODES = new Set(US_STATES.map((s) => s.code));
const US_ZIP = /^\d{5}(-\d{4})?$/;

export const bridgeAssessmentSchema = z.object({
  goal: enumOf(GOAL_OPTIONS),
  role: enumOf(ROLE_OPTIONS),
  timeline: enumOf(TIMELINE_OPTIONS),
  city: z.string().trim().min(1, "City is required").max(100),
  state: z
    .string()
    .trim()
    .toUpperCase()
    .refine((code) => STATE_CODES.has(code), "Choose a state"),
  zip: z.string().trim().regex(US_ZIP, "Enter a 5-digit ZIP code"),
  investmentLevel: enumOf(INVESTMENT_LEVEL_OPTIONS),
  liquidCapital: enumOf(LIQUID_CAPITAL_OPTIONS),
  priority: enumOf(PRIORITY_OPTIONS),
  notes: z.string().trim().max(2000, "Please keep this under 2,000 characters").optional(),
  firstName: z.string().trim().min(1, "First name is required").max(100),
  lastName: z.string().trim().min(1, "Last name is required").max(100),
  email: z.string().trim().email("Enter a valid email address").max(320),
  phone: z
    .string()
    .trim()
    .min(7, "Enter a phone number we can reach you at")
    .max(30, "Enter a valid phone number"),
  /**
   * Latest playback report at submit time (anonymous page only — there was
   * no lead to report to yet). Applied to the new lead's overview progress.
   */
  video: z
    .object({
      currentTime: z.number().min(0).max(60 * 60 * 24),
      duration: z.number().min(0).max(60 * 60 * 24),
      percent: z.number().min(0).max(100),
      secondsWatched: z.number().min(0).max(60 * 60 * 24),
    })
    .optional(),
  /** First-touch attribution captured in the browser (UTMs, click IDs, Meta cookies). */
  attribution: z
    .object({
      url: z.string().max(2000).optional(),
      referrer: z.string().max(2000).nullable().optional(),
      fbp: z.string().max(200).nullable().optional(),
      fbc: z.string().max(200).nullable().optional(),
    })
    .optional(),
  /** Honeypot — real visitors never see or fill this field. */
  website: z.string().max(200).optional(),
});

export type BridgeAssessmentInput = z.infer<typeof bridgeAssessmentSchema>;

/**
 * A prospect who arrived through their tokenized link (/watch/[token]) is
 * already a lead — name, email, and phone are on file, so the contact
 * step is dropped and the honeypot is unnecessary.
 */
export const knownLeadAssessmentSchema = bridgeAssessmentSchema.omit({
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  website: true,
  attribution: true,
  video: true,
});

export type KnownLeadAssessmentInput = z.infer<typeof knownLeadAssessmentSchema>;

/** Client-side validation for the two typed steps. */
export const locationStepSchema = bridgeAssessmentSchema.pick({ city: true, state: true, zip: true });
export const contactStepSchema = bridgeAssessmentSchema.pick({
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  notes: true,
});

export type ChoiceKey =
  | "goal"
  | "role"
  | "timeline"
  | "investmentLevel"
  | "liquidCapital"
  | "priority";

export interface ChoiceStep {
  kind: "choice";
  key: ChoiceKey;
  prompt: string;
  helper?: string;
  options: OptionList;
}
export interface LocationStep {
  kind: "location";
  key: "location";
  prompt: string;
  helper: string;
}
export interface ContactStep {
  kind: "contact";
  key: "contact";
  prompt: string;
  helper: string;
}
export type BridgeStep = ChoiceStep | LocationStep | ContactStep;

/** One question per screen, in order. The counter reads "Step N of 8". */
export const BRIDGE_STEPS: readonly BridgeStep[] = [
  {
    kind: "choice",
    key: "goal",
    prompt: "What are you hoping business ownership changes for you?",
    helper: "Choose the closest answer.",
    options: GOAL_OPTIONS,
  },
  {
    kind: "choice",
    key: "role",
    prompt: "What kind of ownership role sounds most appealing?",
    options: ROLE_OPTIONS,
  },
  {
    kind: "choice",
    key: "timeline",
    prompt: "How soon would you ideally like to start?",
    options: TIMELINE_OPTIONS,
  },
  {
    kind: "location",
    key: "location",
    prompt: "Where would you want to build your CMDT business?",
    helper: "We use this to help evaluate territory availability and local market considerations.",
  },
  {
    kind: "choice",
    key: "investmentLevel",
    prompt: "If CMDT looks like the right fit, what level of investment would you be comfortable exploring?",
    options: INVESTMENT_LEVEL_OPTIONS,
  },
  {
    kind: "choice",
    key: "liquidCapital",
    prompt: "Approximately how much liquid capital could you make available for the right opportunity?",
    options: LIQUID_CAPITAL_OPTIONS,
  },
  {
    kind: "choice",
    key: "priority",
    prompt: "What do you most want to understand before deciding whether CMDT deserves a closer look?",
    options: PRIORITY_OPTIONS,
  },
  {
    kind: "contact",
    key: "contact",
    prompt: "Last step: where should we send your next step?",
    helper: "Your answers stay with the CMDT team. No newsletters, no automated sales sequence.",
  },
];

/** The screens for a prospect we already know: the seven questions, no contact step. */
export const BRIDGE_STEPS_KNOWN: readonly BridgeStep[] = BRIDGE_STEPS.filter(
  (step) => step.kind !== "contact",
);

export function bridgeStepsFor(known: boolean): readonly BridgeStep[] {
  return known ? BRIDGE_STEPS_KNOWN : BRIDGE_STEPS;
}

export type FitLevel = "strong" | "standard";

/**
 * Whether the answers point to a strong fit — the completion screen then
 * leads with "Schedule a Conversation" instead of "Keep Researching".
 * Mirrors the portal's hard qualification rule: liquid capital at or above
 * the qualifying floor and a timeline that isn't "just researching".
 * "Prefer to discuss privately" is neutral, never a disqualifier.
 */
export function assessFit(answers: Pick<BridgeAssessmentInput, "liquidCapital" | "timeline">): FitLevel {
  const capitalIndex = LIQUID_CAPITAL_ORDER.indexOf(
    answers.liquidCapital as (typeof LIQUID_CAPITAL_ORDER)[number],
  );
  const floorIndex = LIQUID_CAPITAL_ORDER.indexOf(MIN_QUALIFYING_LIQUID_CAPITAL);
  const capitalOk = capitalIndex >= 0 && capitalIndex >= floorIndex;
  const timelineOk = ["asap", "within-3-months", "3-6-months"].includes(answers.timeline);
  return capitalOk && timelineOk ? "strong" : "standard";
}

export function labelFor(options: OptionList, value: string): string {
  return options.find((o) => o.value === value)?.label ?? value;
}

/**
 * Advisor-readable snapshot of every answer (question text + label, not
 * just the stored value), recorded on the lead's event history.
 */
export interface AnswerSnapshotEntry {
  key: string;
  question: string;
  value: string;
  label: string;
}

export function answerSnapshot(input: KnownLeadAssessmentInput): AnswerSnapshotEntry[] {
  const choices = BRIDGE_STEPS.filter((s): s is ChoiceStep => s.kind === "choice");
  const snapshot: AnswerSnapshotEntry[] = choices.map((step) => ({
    key: step.key,
    question: step.prompt,
    value: input[step.key],
    label: labelFor(step.options, input[step.key]),
  }));
  const location = `${input.city}, ${input.state} ${input.zip}`;
  snapshot.push({
    key: "location",
    question: BRIDGE_STEPS[3].prompt,
    value: location,
    label: location,
  });
  if (input.notes) {
    snapshot.push({
      key: "notes",
      question: "Anything else you’d like us to know?",
      value: input.notes,
      label: input.notes,
    });
  }
  return snapshot;
}
