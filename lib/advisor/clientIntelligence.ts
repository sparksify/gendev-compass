import {
  LENDER_STATUS_WEIGHTS,
  SCORE_WEIGHTS,
  getScoreThreshold,
} from "@/lib/config/qualification";
import type { PortalEventRecord } from "@/types/analytics";
import type { QuestionnaireRecord } from "@/types/questionnaire";

/**
 * The client-intelligence read on the detail page: an intent band, the
 * qualification score broken back down into the factors that produced it, and
 * how the stage is aging.
 *
 * Everything here is a projection of stored values — the same weights
 * lib/portal/qualification scores with — so the card can never claim a signal
 * the record doesn't support. Factors with no answer read "Unknown" rather
 * than being scored as zero, which would look like a weakness instead of a
 * gap.
 */

export type FactorStrength = "Strong" | "Moderate" | "Weak" | "Unknown";

export interface QualificationFactor {
  label: string;
  strength: FactorStrength;
}

/** Highest weight in a band → Strong, mid → Moderate, nothing → Weak. */
function bandFor(
  value: number | null | undefined,
  strong: number,
  moderate: number,
): FactorStrength {
  if (value === null || value === undefined) return "Unknown";
  if (value >= strong) return "Strong";
  if (value >= moderate) return "Moderate";
  return "Weak";
}

/**
 * The four factors the qualification score is built from, in the order the
 * handoff prints them.
 */
export function qualificationFactors(
  questionnaire: QuestionnaireRecord | null,
): QualificationFactor[] {
  const capital = questionnaire?.liquid_capital
    ? (SCORE_WEIGHTS.liquidCapital[
        questionnaire.liquid_capital as keyof typeof SCORE_WEIGHTS.liquidCapital
      ] ?? null)
    : null;

  const timeline = questionnaire?.investment_timeline
    ? (SCORE_WEIGHTS.timeline[
        questionnaire.investment_timeline as keyof typeof SCORE_WEIGHTS.timeline
      ] ?? null)
    : null;

  const ownership = questionnaire?.business_ownership
    ? (SCORE_WEIGHTS.businessOwnership[
        questionnaire.business_ownership as keyof typeof SCORE_WEIGHTS.businessOwnership
      ] ?? null)
    : null;

  // Someone funding without financing is fully funded by definition; otherwise
  // readiness is how far along they are with a lender.
  const financing =
    questionnaire?.financing_need === "no"
      ? 100
      : questionnaire?.lender_status
        ? (LENDER_STATUS_WEIGHTS[questionnaire.lender_status] ?? null)
        : null;

  return [
    { label: "Liquidity", strength: bandFor(capital, 25, 15) },
    { label: "Timeline", strength: bandFor(timeline, 20, 15) },
    { label: "Experience", strength: bandFor(ownership, 10, 7) },
    { label: "Financing", strength: bandFor(financing, 90, 50) },
  ];
}

export interface IntentRead {
  /** "HIGH INTENT" / "MEDIUM INTENT" / "EARLY INTEREST". */
  band: string;
  /** One line on which way engagement is moving, from recorded events. */
  trend: string;
}

/**
 * Intent from the qualification score, plus a trend read from the event log:
 * this week's recorded activity against the week before it.
 */
export function intentRead(
  score: number | null,
  events: PortalEventRecord[],
  now: Date = new Date(),
): IntentRead {
  const threshold = getScoreThreshold();
  const band =
    score === null
      ? "UNSCORED"
      : score >= threshold
        ? "HIGH INTENT"
        : score >= threshold / 2
          ? "MEDIUM INTENT"
          : "EARLY INTEREST";

  const DAY = 86_400_000;
  const at = (event: PortalEventRecord) =>
    new Date(event.occurred_at ?? event.created_at).getTime();
  const cutoff = now.getTime() - 7 * DAY;
  const previousCutoff = now.getTime() - 14 * DAY;

  const thisWeek = events.filter((event) => at(event) >= cutoff).length;
  const lastWeek = events.filter(
    (event) => at(event) >= previousCutoff && at(event) < cutoff,
  ).length;

  const trend =
    thisWeek === 0
      ? "No activity this week"
      : thisWeek > lastWeek
        ? "Engagement rising this week"
        : thisWeek < lastWeek
          ? "Engagement easing off this week"
          : "Engagement steady this week";

  return { band, trend };
}

export interface StageAge {
  label: string;
  tone: "success" | "warning" | "danger";
}

/**
 * How a stage is aging. A week is unremarkable, a fortnight is worth a look,
 * beyond that the deal has stopped moving.
 */
export function stageAge(days: number | null): StageAge | null {
  if (days === null) return null;
  if (days <= 7) return { label: "Normal", tone: "success" };
  if (days <= 14) return { label: "Watch", tone: "warning" };
  return { label: "Stalled", tone: "danger" };
}
