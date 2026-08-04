/**
 * Portal content configuration: FAQ, resource library, and coming-soon
 * modules. Copy is process-focused and makes no investment claims
 * (spec: legal placeholders until approved copy is provided).
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
    question: "Who is this investment appropriate for?",
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

export interface ComingSoonItem {
  key: string;
  title: string;
  /** Compact label for the narrow left rail. */
  shortTitle?: string;
}

export const COMING_SOON: ComingSoonItem[] = [
  { key: "territory", title: "Territory Availability Checker", shortTitle: "Territory Availability" },
  { key: "market-map", title: "Interactive Territory Map" },
  { key: "market-analysis", title: "Personalized Market Analysis" },
];

/** Displayed length of the investor overview when the player hasn't loaded. */
export const VIDEO_ESTIMATED_MINUTES = 22;
