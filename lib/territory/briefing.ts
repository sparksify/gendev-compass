import { stateName } from "@/lib/geocoding/states";
import { STATE_ELIGIBILITY_LABELS, type TerritoryEvaluationResult, type TerritoryResultStatus } from "@/types/territory";

/**
 * Territory Intelligence briefing layer: turns a structured evaluation
 * result into an investor-grade narrative, an availability signal, and the
 * "Why this market?" panel. Everything here is DETERMINISTIC presentation
 * of facts the evaluation already established — no LLM, and no invented
 * market figures (missing data is simply not mentioned). The status itself
 * is decided entirely by lib/territory/evaluate.ts.
 */

// U.S. median household income, ACS 5-Year 2019–2023 (B19013, dollars).
// Used only as a comparison benchmark when a real local figure exists.
export const US_MEDIAN_HOUSEHOLD_INCOME = 78538;
// U.S. population change between the ACS 5-Year 2014–2018 and 2019–2023
// windows (~322.9M → ~332.4M) — the same comparison basis the import
// pipeline uses for ZIP-level growth.
export const US_5YR_POPULATION_GROWTH_PCT = 2.9;

export interface AvailabilitySignal {
  /** 0–100 preliminary availability signal (presentation of the status). */
  percent: number;
  label: string;
  /** One-line explanation of what the signal reflects. */
  basis: string;
}

/**
 * A visual restatement of the deterministic screening result. The percent
 * is a fixed mapping from status (adjusted by measured overlap) — it is a
 * communication device, not a probability model, and the basis line says so.
 */
export function availabilitySignal(result: TerritoryEvaluationResult): AvailabilitySignal {
  const overlap = result.evaluation.overlapPercentage;
  switch (result.status) {
    case "AVAILABLE":
      return {
        percent: 92,
        label: "Strong availability signal",
        basis: "No conflict found with any sold or reserved territory in current records.",
      };
    case "PARTIALLY_AVAILABLE":
      return {
        percent: Math.max(40, 75 - Math.round(overlap / 2)),
        label: "Partial availability",
        basis: `About ${overlap}% of the evaluated area overlaps existing territory commitments.`,
      };
    case "MANUAL_REVIEW":
      return {
        percent: 42,
        label: "Needs team review",
        basis: "The current territory configuration requires confirmation by the GenDev team.",
      };
    case "STATE_RESTRICTED":
      return {
        percent: 12,
        label: "State not currently open",
        basis: "Franchise registration status blocks sales in this state right now.",
      };
    case "UNAVAILABLE":
      return {
        percent: 8,
        label: "Territory conflict found",
        basis: "The searched market overlaps a sold or reserved territory.",
      };
    default:
      return { percent: 0, label: "No signal", basis: "The search did not produce an evaluation." };
  }
}

function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} million`;
  if (value >= 10_000) return `${Math.round(value / 1000).toLocaleString()},000+`;
  return value.toLocaleString();
}

/**
 * The "Territory Assessment" narrative: a short investment-briefing style
 * write-up composed only from established facts (status, real Census
 * figures when loaded, state eligibility). Returns paragraphs.
 */
export function buildTerritoryAssessment(result: TerritoryEvaluationResult): string[] {
  const paragraphs: string[] = [];
  const place = result.location.city ?? result.location.displayName ?? "This market";
  const state = result.location.stateCode ? stateName(result.location.stateCode) : null;
  const { marketData } = result;

  // Market character — only when real data exists.
  const facts: string[] = [];
  if (marketData.population != null) {
    facts.push(`a population of roughly ${formatCompact(marketData.population)} across the evaluated area`);
  }
  if (marketData.populationGrowthPct != null && marketData.populationGrowthPct > US_5YR_POPULATION_GROWTH_PCT) {
    facts.push(
      `five-year population growth of ${marketData.populationGrowthPct.toFixed(1)}% — ahead of the national pace of ${US_5YR_POPULATION_GROWTH_PCT}%`,
    );
  } else if (marketData.populationGrowthPct != null) {
    facts.push(`five-year population growth of ${marketData.populationGrowthPct.toFixed(1)}%`);
  }
  if (marketData.medianHouseholdIncome != null) {
    const vsNational = marketData.medianHouseholdIncome >= US_MEDIAN_HOUSEHOLD_INCOME * 1.1
      ? ", well above the national median"
      : marketData.medianHouseholdIncome >= US_MEDIAN_HOUSEHOLD_INCOME
        ? ", above the national median"
        : "";
    facts.push(
      `a median household income near $${marketData.medianHouseholdIncome.toLocaleString()}${vsNational}`,
    );
  }
  if (facts.length > 0) {
    const factSentence =
      facts.length === 1 ? facts[0] : `${facts.slice(0, -1).join(", ")}, and ${facts[facts.length - 1]}`;
    // Cite the source only when the data actually carries one (real Census
    // figures loaded via the admin import) — never for placeholder dev data.
    const attribution = marketData.source ? ` (${marketData.source})` : "";
    paragraphs.push(`${place}${state ? `, ${state},` : ""} shows ${factSentence}${attribution}.`);
  }

  // Screening outcome in briefing language.
  const outcomes: Record<TerritoryResultStatus, string | null> = {
    AVAILABLE:
      `Based on our preliminary review, we did not find a conflict between this market and any sold or reserved ` +
      `${result.brandName} territory. It appears to be a strong candidate for further review.`,
    PARTIALLY_AVAILABLE:
      `Our preliminary review found that parts of the evaluated area overlap existing territory commitments, while ` +
      `other parts appear open. A GenDev team review can map the exact opportunity around ${place}.`,
    UNAVAILABLE:
      `Our preliminary review found that this specific market overlaps a territory that is already committed. The ` +
      `surrounding region may still hold opportunities — the nearby markets below are a good place to keep exploring.`,
    STATE_RESTRICTED: state
      ? `${result.brandName} is not currently offered in ${state} due to franchise registration requirements. The ` +
        `GenDev team can advise on timing or alternative regions.`
      : null,
    MANUAL_REVIEW:
      `This market's territory configuration needs a closer look before we can give a preliminary answer — the ` +
      `GenDev team reviews these directly, typically within one business day of a review request.`,
    LOCATION_NOT_FOUND: null,
    BRAND_NOT_CONFIGURED: null,
  };
  const outcome = outcomes[result.status];
  if (outcome) paragraphs.push(outcome);

  if (paragraphs.length > 0) {
    paragraphs.push(
      `Final territory availability is always confirmed by the GenDev team and the franchisor before any commitment.`,
    );
  }
  return paragraphs;
}

export interface WhyThisMarketSection {
  title: string;
  points: string[];
}

/**
 * The collapsible "Why this market?" panel: demand context from real data,
 * brand-fit context from brand positioning copy, and honest caveats.
 * Sections with nothing factual to say are omitted entirely.
 */
export function buildWhyThisMarket(result: TerritoryEvaluationResult): WhyThisMarketSection[] {
  const sections: WhyThisMarketSection[] = [];
  const { marketData } = result;
  const state = result.location.stateCode ? stateName(result.location.stateCode) : null;

  const demand: string[] = [];
  if (marketData.population != null && marketData.households != null) {
    demand.push(
      `${formatCompact(marketData.population)} residents in ${formatCompact(marketData.households)} households across the evaluated ZIP codes.`,
    );
  } else if (marketData.population != null) {
    demand.push(`${formatCompact(marketData.population)} residents across the evaluated ZIP codes.`);
  }
  if (marketData.populationGrowthPct != null && marketData.populationGrowthPct > 0) {
    demand.push(
      `The area added ${marketData.populationGrowthPct.toFixed(1)}% population over five years${
        marketData.populationGrowthPct > US_5YR_POPULATION_GROWTH_PCT ? ` — faster than the U.S. overall (${US_5YR_POPULATION_GROWTH_PCT}%)` : ""
      }, a demand signal for workplace services tied to hiring.`,
    );
  }
  if (marketData.medianHouseholdIncome != null && marketData.medianHouseholdIncome > US_MEDIAN_HOUSEHOLD_INCOME) {
    demand.push(
      `Median household income of $${marketData.medianHouseholdIncome.toLocaleString()} runs above the U.S. median ($${US_MEDIAN_HOUSEHOLD_INCOME.toLocaleString()}).`,
    );
  }
  if (demand.length > 0) {
    sections.push({ title: "Market demand signals", points: demand });
  }

  // Brand-fit positioning copy. CMDT is the platform's only live brand;
  // when a second brand onboards this moves onto the brand record/config.
  sections.push({
    title: `Why ${result.brandName} fits markets like this`,
    points: [
      "Drug and alcohol testing demand tracks employers, not storefront retail — growing job markets mean growing compliance testing needs (DOT-regulated fleets, construction, staffing, healthcare).",
      "The mobile, home-based model keeps overhead low, so a territory's value comes from its employer base rather than expensive commercial real estate.",
      "Recurring workplace-testing relationships (random pools, pre-employment programs) build repeat revenue rather than one-off transactions.",
    ],
  });

  const caveats: string[] = [];
  if (result.stateEligibility.status && result.stateEligibility.status !== "approved" && result.stateEligibility.status !== "exempt") {
    caveats.push(
      `${state ?? "This state"} currently shows registration status "${STATE_ELIGIBILITY_LABELS[result.stateEligibility.status]}" — the GenDev team can explain what that means for timing.`,
    );
  }
  if (result.requiresManualReview) {
    caveats.push("Parts of the territory configuration here need staff review before availability can be confirmed.");
  }
  if (result.evaluation.overlapPercentage > 0) {
    caveats.push(
      `${result.evaluation.overlapPercentage}% of the evaluated area overlaps existing territory commitments.`,
    );
  }
  caveats.push(
    "All results are a preliminary screening. Territory grants are defined in the Franchise Disclosure Document and confirmed in writing by the franchisor.",
  );
  sections.push({ title: "What still needs verification", points: caveats });

  return sections;
}
