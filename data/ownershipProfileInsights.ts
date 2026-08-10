/**
 * Ownership Intelligence Report — deterministic interpretation engine.
 *
 * Maps Ownership Profile responses (types/ownershipProfile.ts) to
 * educational due-diligence content: a narrative, research topics,
 * suggested questions, and one next research step. No LLM, no scoring,
 * no recommendations — every string here is "explore / ask / understand"
 * language, never "this franchise fits you" (see the feature spec's copy
 * guidelines).
 *
 * Structured so the same report can later power advisor dashboards, CRM
 * activity, AI assistant context, and PDF export without rework: the
 * builder returns plain serializable data, and UI stays out of this file.
 */

import type {
  ExperienceValue,
  GrowthComfortValue,
  MotivationValue,
  OwnershipProfileInput,
  PriorityValue,
} from "@/types/ownershipProfile";
import { motivationLabels, ownershipStyleLabel } from "@/types/ownershipProfile";

// ---------------------------------------------------------------------------
// Report shape
// ---------------------------------------------------------------------------

export interface DueDiligenceTopic {
  id: string;
  /** Short uppercase-style card label, e.g. "Executive Ownership". */
  title: string;
  /** "Explore/understand/evaluate…" guidance — never an assertion about the brand. */
  guidance: string;
  /** Optional bullet prompts shown under the guidance. */
  suggestedQuestions?: string[];
}

export interface DueDiligenceQuestion {
  id: string;
  text: string;
}

export interface NextResearchStep {
  id: string;
  title: string;
  /** Why this research area follows from the investor's responses. */
  rationale: string;
  /** CTA label; omitted (with href) when no suitable destination exists. */
  ctaLabel?: string;
  /** Portal-relative path appended to /p/<token>; only existing routes. */
  ctaPath?: string;
}

export interface OwnershipIntelligenceReport {
  narrative: string[];
  topics: DueDiligenceTopic[];
  questions: DueDiligenceQuestion[];
  nextStep: NextResearchStep | null;
}

// ---------------------------------------------------------------------------
// Narrative fragments — assembled into 1–3 short paragraphs
// ---------------------------------------------------------------------------

/** Ownership-style band derived from the 0–100 slider. */
export type OwnershipStyleBand = "hands-on" | "balanced" | "executive";

export function ownershipStyleBand(score: number): OwnershipStyleBand {
  if (score <= 40) return "hands-on";
  if (score <= 60) return "balanced";
  return "executive";
}

const MOTIVATION_NARRATIVE: Record<MotivationValue, string> = {
  "long-term-wealth":
    "You appear to be approaching business ownership primarily as a long-term wealth-building decision rather than simply creating another job for yourself",
  "replace-income":
    "You indicated that replacing your current income is a central goal, which makes the path and timeline to owner earnings an important area of your research",
  "passive-income":
    "You expressed interest in semi-passive income, which makes the realistic level of owner involvement one of the most important things to pressure-test",
  "leave-corporate":
    "You indicated a desire to transition out of corporate life, suggesting that autonomy and control over your work matter to you",
  "family-business":
    "You indicated interest in building a family business, which may make succession, family involvement, and long-term transferability worth exploring",
  diversify:
    "You appear to view ownership partly as portfolio diversification, which places extra weight on understanding the risk profile of the operating business",
  freedom:
    "You indicated that greater personal freedom is part of what draws you to ownership",
};

const STYLE_NARRATIVE: Record<OwnershipStyleBand, string> = {
  "hands-on":
    "Your responses point toward a hands-on ownership model — being personally involved in daily operations and close to customers and staff.",
  balanced:
    "Your responses suggest a balanced ownership model — involved in the business day to day, while building systems and people you can delegate to over time.",
  executive:
    "You indicated a preference for an executive ownership model — leading strategically rather than personally handling every day-to-day operational responsibility.",
};

const GROWTH_NARRATIVE: Record<GrowthComfortValue, string> = {
  "one-location":
    "You currently see yourself operating a single location, which keeps the evaluation focused on unit-level economics and the owner's role in one market.",
  "a-few-locations":
    "You expressed openness to operating more than one location over time, so it may be useful to understand how owners typically sequence a second unit.",
  "regional-expansion":
    "You appear interested in an opportunity that may support expansion beyond a single territory, which makes territory availability and multi-unit infrastructure worth understanding early.",
  "large-organization":
    "You indicated ambitions toward building a larger organization, which places extra weight on scalability, management structure, and how additional territories are awarded.",
  "not-sure":
    "You haven't settled on a growth ambition yet, which is common at this stage — understanding what single-unit and multi-unit ownership each require can help clarify it.",
};

/** Priorities that get a clause appended to the style paragraph. */
const PRIORITY_MENTIONS: Partial<Record<PriorityValue, string>> = {
  "lifestyle-flexibility": "lifestyle flexibility",
  "recurring-revenue": "recurring revenue",
  "strong-brand": "strong brands",
  "mission-driven": "mission-driven businesses",
  scalability: "scalable operations",
  "simple-operations": "operational simplicity",
  "low-employee-count": "lean staffing",
  "large-protected-territory": "meaningful protected territory",
  "community-impact": "community impact",
  "predictable-demand": "predictable demand",
};

// ---------------------------------------------------------------------------
// Due diligence topics
// ---------------------------------------------------------------------------

const STYLE_TOPICS: Record<OwnershipStyleBand, DueDiligenceTopic> = {
  executive: {
    id: "topic-executive-ownership",
    title: "Executive Ownership",
    guidance:
      "Explore how much day-to-day owner involvement this franchise requires and what management structure established franchisees use.",
    suggestedQuestions: [
      "Which responsibilities are commonly delegated?",
      "When do owners typically add management?",
      "How much time is spent on sales, operations, and leadership?",
    ],
  },
  balanced: {
    id: "topic-owner-role",
    title: "The Owner's Role",
    guidance:
      "Understand which responsibilities owners keep for themselves, which they delegate, and how that balance shifts as the business matures.",
    suggestedQuestions: [
      "What does the owner personally handle in year one versus year three?",
      "Which roles are typically the first hires?",
    ],
  },
  "hands-on": {
    id: "topic-daily-operations",
    title: "Daily Operations",
    guidance:
      "Investigate what a typical operating day involves for a hands-on owner — customer work, scheduling, quality control, and administration.",
    suggestedQuestions: [
      "What does a typical week of hands-on ownership look like?",
      "Which operational skills matter most in the first year?",
    ],
  },
};

const GROWTH_TOPICS: Partial<Record<GrowthComfortValue, DueDiligenceTopic>> = {
  "regional-expansion": {
    id: "topic-scalability-expansion",
    title: "Scalability & Expansion",
    guidance:
      "Explore how additional territories are awarded and what infrastructure is required to operate multiple markets.",
  },
  "large-organization": {
    id: "topic-scalability-expansion",
    title: "Scalability & Expansion",
    guidance:
      "Explore how multi-unit ownership works in this system — how territories are awarded, what infrastructure larger operators build, and when owners typically add dedicated management.",
  },
  "a-few-locations": {
    id: "topic-second-unit",
    title: "Path to a Second Unit",
    guidance:
      "Ask how existing owners decided when to open a second location and what they needed in place — people, systems, and capital — before expanding.",
  },
};

const PRIORITY_TOPICS: Partial<Record<PriorityValue, DueDiligenceTopic>> = {
  "lifestyle-flexibility": {
    id: "topic-owner-time",
    title: "Owner Time Commitment",
    guidance:
      "Speak with franchisees about how their weekly time is actually divided between business development, administration, operations, and management.",
  },
  "recurring-revenue": {
    id: "topic-retention",
    title: "Customer Retention & Repeat Business",
    guidance:
      "Understand which parts of the business may generate repeat customer relationships and how those relationships are developed and maintained.",
  },
  "low-employee-count": {
    id: "topic-staffing",
    title: "Staffing Model",
    guidance:
      "Understand the minimum team required to operate effectively and how staffing needs change as the business grows.",
  },
  "mission-driven": {
    id: "topic-community-impact",
    title: "Customer & Community Impact",
    guidance:
      "Explore how franchisees interact with customers and what role the business plays in its local market.",
  },
  "community-impact": {
    id: "topic-community-impact",
    title: "Customer & Community Impact",
    guidance:
      "Explore how franchisees interact with customers and what role the business plays in its local market.",
  },
  "simple-operations": {
    id: "topic-operating-model",
    title: "Operating Complexity",
    guidance:
      "Evaluate how many moving parts the day-to-day business involves — services, scheduling, equipment, compliance — and what the franchisor systematizes for you.",
  },
  "strong-brand": {
    id: "topic-brand-standards",
    title: "Brand & System Standards",
    guidance:
      "Review how the franchisor builds and protects the brand, and what standards franchisees are expected to maintain locally.",
  },
  scalability: {
    id: "topic-scalability-expansion",
    title: "Scalability & Expansion",
    guidance:
      "Explore how additional territories are awarded and what infrastructure is required to operate multiple markets.",
  },
  "large-protected-territory": {
    id: "topic-territory",
    title: "Territory Definition & Protection",
    guidance:
      "Review how territories are defined, what exclusivity means in practice, and how neighboring territories interact.",
  },
  "predictable-demand": {
    id: "topic-demand-drivers",
    title: "Demand Drivers",
    guidance:
      "Investigate what drives customer demand in this category, how seasonal or cyclical it tends to be, and which customer segments generate the steadiest activity.",
  },
};

// ---------------------------------------------------------------------------
// Due diligence questions
// ---------------------------------------------------------------------------

const STYLE_QUESTIONS: Record<OwnershipStyleBand, DueDiligenceQuestion[]> = {
  executive: [
    {
      id: "q-owner-week",
      text: "What does a typical owner's week look like once the business is established?",
    },
    {
      id: "q-delegation",
      text: "Which responsibilities can realistically be delegated to employees or managers?",
    },
  ],
  balanced: [
    {
      id: "q-owner-week",
      text: "What does a typical owner's week look like once the business is established?",
    },
    {
      id: "q-first-hires",
      text: "Which roles do owners typically hire first, and when?",
    },
  ],
  "hands-on": [
    {
      id: "q-owner-day",
      text: "What does a typical operating day look like for a hands-on owner?",
    },
    {
      id: "q-training",
      text: "How does initial training prepare a new owner for daily operations?",
    },
  ],
};

const GROWTH_QUESTIONS: Partial<Record<GrowthComfortValue, DueDiligenceQuestion[]>> = {
  "regional-expansion": [
    {
      id: "q-expansion-infrastructure",
      text: "What infrastructure is typically needed before operating additional territories?",
    },
    {
      id: "q-territory-awards",
      text: "How are additional territories awarded or reserved?",
    },
  ],
  "large-organization": [
    {
      id: "q-expansion-infrastructure",
      text: "What infrastructure is typically needed before operating additional territories?",
    },
    {
      id: "q-territory-awards",
      text: "How are additional territories awarded or reserved?",
    },
  ],
  "a-few-locations": [
    {
      id: "q-second-unit-timing",
      text: "How do existing owners decide when they're ready for a second location?",
    },
  ],
};

const PRIORITY_QUESTIONS: Partial<Record<PriorityValue, DueDiligenceQuestion[]>> = {
  "lifestyle-flexibility": [
    {
      id: "q-time-commitment",
      text: "How do established franchisees describe their actual weekly time commitment?",
    },
  ],
  "strong-brand": [
    {
      id: "q-brand-standards",
      text: "What brand standards are most important to maintaining consistency across the system?",
    },
  ],
  "mission-driven": [
    {
      id: "q-community-impact",
      text: "What impact do franchisees typically have on their customers or communities?",
    },
  ],
  "recurring-revenue": [
    {
      id: "q-repeat-relationships",
      text: "Which customer relationships tend to repeat, and how are they maintained over time?",
    },
  ],
  "low-employee-count": [
    {
      id: "q-min-staffing",
      text: "What is the minimum team needed to operate effectively, and how does it grow?",
    },
  ],
  "large-protected-territory": [
    {
      id: "q-territory-definition",
      text: "How are territories defined and protected, and what happens at the boundaries?",
    },
  ],
  "predictable-demand": [
    {
      id: "q-demand-drivers",
      text: "What drives demand in this category, and how seasonal or cyclical is it?",
    },
  ],
};

const B2B_QUESTIONS: DueDiligenceQuestion[] = [
  {
    id: "q-b2b-relationships",
    text: "How are local business relationships typically developed?",
  },
  {
    id: "q-b2b-owner-activity",
    text: "What portion of owner activity involves business development and account management?",
  },
];

const EXPERIENCE_QUESTIONS: Partial<Record<ExperienceValue, DueDiligenceQuestion[]>> = {
  management: [
    {
      id: "q-leadership-growth",
      text: "What leadership responsibilities tend to become more important as the business grows?",
    },
  ],
  "corporate-executive": [
    {
      id: "q-leadership-growth",
      text: "What leadership responsibilities tend to become more important as the business grows?",
    },
  ],
  military: [
    {
      id: "q-veteran-programs",
      text: "Are there programs, discounts, resources, or franchisee groups available for veterans?",
    },
  ],
  "no-previous-ownership": [
    {
      id: "q-first-time-support",
      text: "What support does the franchisor provide to first-time business owners specifically?",
    },
  ],
};

// ---------------------------------------------------------------------------
// Next research step (single winner, priority-ordered)
// ---------------------------------------------------------------------------

const NEXT_STEP_OWNERSHIP_MODEL: NextResearchStep = {
  id: "next-ownership-model",
  title: "Explore the Ownership Model",
  rationale:
    "Because you indicated a preference for executive ownership, learning how owners structure staffing, management, sales, and day-to-day responsibilities may be especially useful.",
  ctaLabel: "Explore the Opportunity",
  ctaPath: "/opportunity",
};

const NEXT_STEP_TERRITORY: NextResearchStep = {
  id: "next-territory-growth",
  title: "Explore Territory & Growth",
  rationale:
    "Because you expressed interest in operating beyond a single market, understanding how territories are defined, protected, and awarded may be a productive next step.",
  ctaLabel: "Open Territory Intelligence",
  ctaPath: "/territory-advisor",
};

const NEXT_STEP_OWNER_ROLE: NextResearchStep = {
  id: "next-owner-role",
  title: "Understand the Owner's Role",
  rationale:
    "Because lifestyle flexibility matters to you, learning how established owners actually spend their time — and what the business requires of them — may be especially useful.",
  ctaLabel: "Explore the Opportunity",
  ctaPath: "/opportunity",
};

const NEXT_STEP_BRAND_STORY: NextResearchStep = {
  id: "next-brand-story",
  title: "Explore the Brand Story",
  rationale:
    "Because mission and impact matter to you, reviewing how the brand positions itself and serves its customers may help you evaluate whether its purpose resonates with yours.",
  ctaLabel: "Explore the Opportunity",
  ctaPath: "/opportunity",
};

const NEXT_STEP_CUSTOMER_MODEL: NextResearchStep = {
  id: "next-customer-model",
  title: "Understand the Customer Model",
  rationale:
    "Because you expressed interest in B2B services, understanding who the customers are and how relationships with them are built may be a useful focus for your next conversations.",
  ctaLabel: "Explore the Opportunity",
  ctaPath: "/opportunity",
};

// ---------------------------------------------------------------------------
// Report builder
// ---------------------------------------------------------------------------

function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

const MAX_TOPICS = 5;
const MIN_TOPICS = 3;
const MAX_QUESTIONS = 8;

function buildNarrative(profile: OwnershipProfileInput): string[] {
  const paragraphs: string[] = [];

  // Paragraph 1 — motivations (lead with the first two selected).
  const motivationFragments = profile.motivations
    .slice(0, 2)
    .map((value) => MOTIVATION_NARRATIVE[value])
    .filter(Boolean);
  if (motivationFragments.length > 0) {
    paragraphs.push(`${motivationFragments.join(". ")}.`);
  }

  // Paragraph 2 — ownership style + up to three priority mentions.
  const band = ownershipStyleBand(profile.ownershipStyle);
  let stylePara = STYLE_NARRATIVE[band];
  const mentions = profile.priorities
    .map((value) => PRIORITY_MENTIONS[value])
    .filter((mention): mention is string => Boolean(mention))
    .slice(0, 3);
  if (mentions.length > 0) {
    const list =
      mentions.length === 1
        ? mentions[0]
        : `${mentions.slice(0, -1).join(", ")}${mentions.length > 2 ? "," : ""} and ${mentions[mentions.length - 1]}`;
    stylePara += ` You noted particular interest in ${list}.`;
  }
  paragraphs.push(stylePara);

  // Paragraph 3 — growth ambition.
  if (profile.growthComfort) {
    paragraphs.push(GROWTH_NARRATIVE[profile.growthComfort]);
  }

  return paragraphs;
}

function buildTopics(profile: OwnershipProfileInput): DueDiligenceTopic[] {
  const band = ownershipStyleBand(profile.ownershipStyle);
  const candidates: DueDiligenceTopic[] = [STYLE_TOPICS[band]];

  // Priority-ordered per the spec: priorities next, then growth ambition.
  for (const priority of profile.priorities) {
    const topic = PRIORITY_TOPICS[priority];
    if (topic) candidates.push(topic);
  }
  if (profile.growthComfort) {
    const topic = GROWTH_TOPICS[profile.growthComfort];
    if (topic) candidates.push(topic);
  }

  const deduped = dedupeById(candidates);
  if (deduped.length >= MIN_TOPICS) return deduped.slice(0, MAX_TOPICS);

  // Sparse profiles: backfill with broadly useful topics so the section
  // never feels empty, still without asserting anything about the brand.
  const fallbacks: DueDiligenceTopic[] = [
    PRIORITY_TOPICS["simple-operations"]!,
    PRIORITY_TOPICS["predictable-demand"]!,
    PRIORITY_TOPICS["strong-brand"]!,
  ];
  return dedupeById([...deduped, ...fallbacks]).slice(0, Math.max(MIN_TOPICS, deduped.length));
}

function buildQuestions(profile: OwnershipProfileInput): DueDiligenceQuestion[] {
  const band = ownershipStyleBand(profile.ownershipStyle);
  const candidates: DueDiligenceQuestion[] = [...STYLE_QUESTIONS[band]];

  for (const priority of profile.priorities) {
    candidates.push(...(PRIORITY_QUESTIONS[priority] ?? []));
  }
  if (profile.growthComfort) {
    candidates.push(...(GROWTH_QUESTIONS[profile.growthComfort] ?? []));
  }
  if (profile.environments.includes("b2b-services")) {
    candidates.push(...B2B_QUESTIONS);
  }
  for (const experience of profile.experience) {
    candidates.push(...(EXPERIENCE_QUESTIONS[experience] ?? []));
  }

  return dedupeById(candidates).slice(0, MAX_QUESTIONS);
}

function buildNextStep(profile: OwnershipProfileInput): NextResearchStep | null {
  const band = ownershipStyleBand(profile.ownershipStyle);
  if (band === "executive") return NEXT_STEP_OWNERSHIP_MODEL;
  if (profile.growthComfort === "regional-expansion" || profile.growthComfort === "large-organization") {
    return NEXT_STEP_TERRITORY;
  }
  if (profile.priorities.includes("lifestyle-flexibility")) return NEXT_STEP_OWNER_ROLE;
  if (profile.priorities.includes("mission-driven") || profile.priorities.includes("community-impact")) {
    return NEXT_STEP_BRAND_STORY;
  }
  if (profile.environments.includes("b2b-services")) return NEXT_STEP_CUSTOMER_MODEL;
  // Hands-on/balanced owners with none of the above: the owner's role is
  // still the most broadly useful research area.
  return NEXT_STEP_OWNER_ROLE;
}

/**
 * Assemble the full report from a completed (or partially completed)
 * profile. Pure and deterministic — same input, same report.
 */
export function buildOwnershipIntelligenceReport(
  profile: OwnershipProfileInput,
): OwnershipIntelligenceReport {
  return {
    narrative: buildNarrative(profile),
    topics: buildTopics(profile),
    questions: buildQuestions(profile),
    nextStep: buildNextStep(profile),
  };
}

/** Compact context line used by the report header (e.g. for print). */
export function reportHeadline(profile: OwnershipProfileInput): string {
  const goals = motivationLabels(profile).slice(0, 2).join(", ");
  const style = ownershipStyleLabel(profile.ownershipStyle);
  return goals ? `${style} · ${goals}` : style;
}
