/**
 * Portal content configuration: FAQ, resource library, opportunity snapshot,
 * and coming-soon modules. Copy is process-focused and makes no investment
 * claims (spec: legal placeholders until approved copy is provided).
 */

export interface FaqItem {
  question: string;
  answer: string;
}

export const FAQ_ITEMS: FaqItem[] = [
  {
    question: "What happens after qualification?",
    answer:
      "Once you complete the investor overview and questionnaire, your responses are reviewed and — when the criteria are met — your consultation unlocks immediately so you can pick a time that suits you. Your advisor reviews your answers before the call so the conversation focuses on your specific goals.",
  },
  {
    question: "How are opportunities evaluated?",
    answer:
      "Each opportunity goes through a structured internal review covering the operating model, the team behind it, and the support provided to investors. The details relevant to your situation are covered during your consultation and in the due diligence materials that follow it.",
  },
  {
    question: "Who is this opportunity appropriate for?",
    answer:
      "The process is designed for individuals evaluating an active ownership opportunity with committed capital and a defined timeline. The questionnaire helps establish fit early — before any of your time is spent in meetings.",
  },
  {
    question: "What information is confidential?",
    answer:
      "Everything you share in this portal is used solely to prepare your qualification review and consultation. Your responses are not shared outside the review team, and detailed financial answers are never passed to third-party analytics tools.",
  },
  {
    question: "What should I prepare before my consultation?",
    answer:
      "Nothing formal is required. It helps to have a clear picture of your available capital, your timeline, and the questions you most want answered — the questionnaire captures these so your advisor arrives prepared.",
  },
];

export interface ResourceItem {
  key: string;
  title: string;
  kind: string;
  /** Download URL when available; undefined renders a not-yet-available state. */
  href?: string;
  /** True when the item unlocks only after the consultation. */
  gated?: boolean;
}

export const RESOURCE_LIBRARY: ResourceItem[] = [
  { key: "brochure", title: "Opportunity Brochure", kind: "PDF" },
  { key: "timeline", title: "Investment Timeline", kind: "PDF" },
  { key: "risk", title: "Risk Overview", kind: "PDF" },
  { key: "faq", title: "Frequently Asked Questions", kind: "PDF" },
  { key: "team", title: "Team Profiles", kind: "PDF" },
];

export interface SnapshotItem {
  key: string;
  title: string;
  icon: "timeline" | "document" | "company" | "team" | "highlights";
}

export const OPPORTUNITY_SNAPSHOT: SnapshotItem[] = [
  { key: "process", title: "Investment Process Timeline", icon: "timeline" },
  { key: "summary", title: "Opportunity Summary PDF", icon: "document" },
  { key: "company", title: "Company Overview", icon: "company" },
  { key: "team", title: "Meet the Leadership Team", icon: "team" },
  { key: "highlights", title: "Key Investment Highlights", icon: "highlights" },
];

export interface ComingSoonItem {
  key: string;
  title: string;
}

export const COMING_SOON: ComingSoonItem[] = [
  { key: "territory", title: "Territory Availability Checker" },
  { key: "market-map", title: "Interactive Territory Map" },
  { key: "market-analysis", title: "Personalized Market Analysis" },
];

/** Displayed length of the investor overview when the player hasn't loaded. */
export const VIDEO_ESTIMATED_MINUTES = 22;
