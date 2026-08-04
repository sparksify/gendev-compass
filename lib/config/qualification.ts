import type { InvestmentTimeline, LiquidCapitalRange, BusinessOwnership } from "@/types/questionnaire";

/**
 * All qualification tuning lives here — nothing in the UI or route handlers
 * should hardcode thresholds. Values can be overridden via environment
 * variables where noted.
 */

/** Minimum liquid capital range that passes the hard qualification rule. */
export const MIN_QUALIFYING_LIQUID_CAPITAL: LiquidCapitalRange = "250k-499k";

/** Ordered from lowest to highest so ranges can be compared by index. */
export const LIQUID_CAPITAL_ORDER: LiquidCapitalRange[] = [
  "lt-100k",
  "100k-249k",
  "250k-499k",
  "500k-999k",
  "1m-2.4m",
  "2.5m-plus",
];

/** Timelines that fail the hard qualification rule. */
export const DISQUALIFYING_TIMELINES: InvestmentTimeline[] = ["researching"];

/** Score contributions (see build spec §13). */
export const SCORE_WEIGHTS = {
  videoCompleted: 20,
  liquidCapital: {
    "lt-100k": 0,
    "100k-249k": 0,
    "250k-499k": 15,
    "500k-999k": 25,
    "1m-2.4m": 35,
    "2.5m-plus": 35,
  } satisfies Record<LiquidCapitalRange, number>,
  timeline: {
    immediately: 25,
    "within-30-days": 20,
    "within-90-days": 15,
    "within-6-months": 0,
    researching: 0,
  } satisfies Record<InvestmentTimeline, number>,
  businessOwnership: {
    "yes-currently": 10,
    "yes-previously": 7,
    no: 0,
  } satisfies Record<BusinessOwnership, number>,
  detailedAnswers: 5,
} as const;

/** Answers longer than this count as "detailed" for scoring. */
export const DETAILED_ANSWER_MIN_LENGTH = 40;

function intFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Score at or above which the calendar unlocks (informational for MVP). */
export function getScoreThreshold(): number {
  return intFromEnv("QUALIFICATION_SCORE_THRESHOLD", 60);
}

/** Percent of the video (0–100) that must be watched to unlock the questionnaire. */
export function getVideoCompletionThreshold(): number {
  const value = intFromEnv("VIDEO_COMPLETION_THRESHOLD", 85);
  return Math.min(100, Math.max(1, value));
}
