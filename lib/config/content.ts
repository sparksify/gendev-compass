/**
 * Portal content configuration: FAQ, resource library, and coming-soon
 * modules.
 */

export type FaqCategoryKey = "business-model" | "ownership-operations" | "territory-investment";

export type FaqIconKey =
  | "shield-check"
  | "repeat"
  | "users"
  | "clipboard-list"
  | "user"
  | "shield"
  | "graduation-cap"
  | "star";

export interface FaqCategory {
  key: FaqCategoryKey;
  label: string;
}

/** Display order for the grouped FAQ layout — not alphabetical. */
export const FAQ_CATEGORIES: FaqCategory[] = [
  { key: "business-model", label: "Business Model" },
  { key: "ownership-operations", label: "Ownership & Operations" },
  { key: "territory-investment", label: "Territory & Investment" },
];

export interface FaqItem {
  question: string;
  answer: string;
  category: FaqCategoryKey;
  icon: FaqIconKey;
}

export const FAQ_ITEMS: FaqItem[] = [
  {
    question: "Why is drug testing considered a recession-resistant business?",
    answer:
      "Drug and alcohol testing is a recurring compliance requirement for many employers, especially DOT-regulated companies and safety-sensitive industries. Testing is needed for hiring, random programs, post-accident situations, reasonable suspicion, and return-to-duty requirements, creating ongoing demand throughout the year.",
    category: "business-model",
    icon: "shield-check",
  },
  {
    question: "How does the business generate recurring revenue?",
    answer:
      "CMDT serves employers with ongoing testing and screening needs rather than one-time services only. Recurring revenue can come from pre-employment testing, random testing, DOT compliance programs, post-accident testing, return-to-duty programs, background checks, and other repeat employer requirements.",
    category: "business-model",
    icon: "repeat",
  },
  {
    question: "Who are CMDT's typical customers?",
    answer:
      "CMDT works with employers and regulated industries such as trucking and logistics companies, construction firms, manufacturers, warehouses, staffing agencies, healthcare organizations, security companies, fleet operators, and other businesses with workplace safety and compliance needs.",
    category: "business-model",
    icon: "users",
  },
  {
    question: "What services can I offer as a CMDT franchise owner?",
    answer:
      "CMDT franchisees can offer mobile drug and alcohol testing, in-office testing, DNA testing, and background checks. These multiple service lines allow franchise owners to serve both employers and individuals within one business model.",
    category: "ownership-operations",
    icon: "clipboard-list",
  },
  {
    question: "Do I need medical experience to own a CMDT franchise?",
    answer:
      "The CMDT materials do not state that prior medical experience is required. Franchisees receive structured onboarding, compliance training, operational playbooks, chain-of-custody procedures, and ongoing support to help them operate according to CMDT standards.",
    category: "ownership-operations",
    icon: "user",
  },
  {
    question: "Is my territory protected?",
    answer:
      "Yes. Each franchise is awarded an exclusive territory of approximately 250,000 population, with no competing CMDT locations placed inside that territory.",
    category: "territory-investment",
    icon: "shield",
  },
  {
    question: "What training and support will I receive?",
    answer:
      "Franchisees receive initial training and certification, operational playbooks, compliance protocols, vendor relationships, marketing guidance, operational coaching, and ongoing support from the corporate team.",
    category: "ownership-operations",
    icon: "graduation-cap",
  },
  {
    question: "What makes CMDT different from other franchise opportunities?",
    answer:
      "CMDT combines essential compliance-driven services, recurring B2B demand, a mobile and in-office service model, multiple revenue streams, protected territories, structured operating systems, and ongoing corporate support. This gives franchise owners several ways to grow within one local market.",
    category: "territory-investment",
    icon: "star",
  },
];

export interface ComingSoonItem {
  key: string;
  title: string;
  /** Compact label for the narrow left rail. */
  shortTitle?: string;
}

/**
 * The original "Territory Availability Checker" entry now ships as the
 * Territory Advisor (components/layout/SidebarNavigation.tsx) — removed from
 * here so the sidebar doesn't show a live feature as still-locked.
 */
export const COMING_SOON: ComingSoonItem[] = [
  { key: "market-map", title: "Interactive Territory Map" },
  { key: "market-analysis", title: "Personalized Market Analysis" },
];

/** Displayed length of the investor overview when the player hasn't loaded. */
export const VIDEO_ESTIMATED_MINUTES = 22;
