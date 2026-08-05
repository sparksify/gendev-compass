/**
 * Opportunity profile data. This module is the single source for the
 * Opportunity Overview page; the shape is deliberately flat and
 * serializable so profiles can move to Supabase without touching the UI.
 * Icons are referenced by string key (see components/opportunity/icons.ts).
 */

export type OpportunityIconKey =
  | "shield-check"
  | "truck"
  | "layers"
  | "refresh"
  | "hard-hat"
  | "factory"
  | "stethoscope"
  | "landmark"
  | "briefcase"
  | "users"
  | "home";

export interface OpportunityFeature {
  key: string;
  icon: OpportunityIconKey;
  title: string;
  description: string;
}

export interface CustomerSegment {
  key: string;
  icon: OpportunityIconKey;
  name: string;
  description: string;
}

export interface SnapshotEntry {
  key: string;
  label: string;
  value: string;
  /** Render the value at display size (investment figures, AUV). */
  emphasize?: boolean;
}

export interface PnlLine {
  key: string;
  label: string;
  amount: string;
  /** Share of sales, e.g. "49%". */
  percentOfSales?: string;
  /** Visual treatment on the statement. */
  variant: "revenue" | "expense" | "subtotal" | "total" | "deduction" | "result";
}

export interface OpportunityDocument {
  key: string;
  title: string;
  /** Short format line, e.g. "24-page PDF". */
  format: string;
  /** What's inside — rendered as a compact list. */
  contents: string[];
  fileSize?: string;
  href?: string;
  ctaLabel: string;
}

export interface OpportunityProfile {
  slug: string;
  name: string;
  /** Compact brand abbreviation used in headings, e.g. "CMDT". */
  shortName: string;
  subtitle: string;
  tags: string[];
  /** Brand logo path under /public; rendered in the snapshot and hero. */
  logoPath?: string;
  websiteUrl?: string;
  /** Human-readable website label, e.g. "www.completemobiledrugtesting.com". */
  websiteLabel?: string;
  /** Download target for the header's "Download Opportunity Overview". */
  overviewDownloadUrl?: string;
  /** Business Overview paragraphs (investment-memo tone). */
  overview: string[];
  features: OpportunityFeature[];
  customers: CustomerSegment[];
  financial: {
    /** Statement heading shown beside the section title, e.g. "2025 Profit & Loss". */
    statementLabel: string;
    pnl: PnlLine[];
    disclaimer: string;
  };
  snapshot: {
    entries: SnapshotEntry[];
    /** "Available" renders with a confirmation mark. */
    item19: string;
    primaryCustomers: string[];
  };
  documents: OpportunityDocument[];
}

/** First profile: Complete Mobile Drug Testing (CMDT). */
export const CMDT_PROFILE: OpportunityProfile = {
  slug: "cmdt",
  name: "Complete Mobile Drug Testing",
  shortName: "CMDT",
  subtitle:
    "A mobile compliance-driven business providing drug testing, alcohol testing, DNA testing, background screening and workforce compliance services for employers and regulated industries.",
  tags: ["B2B", "Healthcare", "Mobile Service", "Home-Based", "Office-Based"],
  logoPath: "/brands/cmdt-logo.svg",
  websiteUrl:
    process.env.NEXT_PUBLIC_CMDT_WEBSITE_URL ?? "https://www.completemobiledrugtesting.com/",
  websiteLabel: "www.completemobiledrugtesting.com",
  overviewDownloadUrl: process.env.NEXT_PUBLIC_CMDT_OVERVIEW_PDF_URL,
  overview: [
    "Complete Mobile Drug Testing (CMDT) is a compliance-driven services business providing mobile and in-office drug testing, alcohol testing, DNA testing, and background screening. Services are delivered on-site at client locations or from a home- or office-based operation, allowing the business to run with a lean physical footprint.",
    "The business serves employers with ongoing regulatory and workforce-screening obligations — including DOT-regulated transportation companies, construction and manufacturing firms, healthcare organizations, staffing agencies, and government contractors. For these customers, testing is a recurring operational requirement rather than a discretionary purchase.",
    "Because engagements are driven by compliance programs, established employer accounts generate repeat testing volume across multiple service lines, with individual and family services providing an additional consumer channel.",
  ],
  features: [
    {
      key: "compliance",
      icon: "shield-check",
      title: "Compliance-Driven Demand",
      description:
        "Drug and alcohol testing is mandated in regulated industries and standard practice across many employers. Demand is tied to compliance obligations rather than discretionary spending.",
    },
    {
      key: "mobile",
      icon: "truck",
      title: "Mobile Operating Model",
      description:
        "Services are delivered on-site at client locations or from a home- or office-based setup. The model operates without a mandatory retail lease or large fixed staff.",
    },
    {
      key: "revenue",
      icon: "layers",
      title: "Multiple Revenue Streams",
      description:
        "Revenue spans drug testing, alcohol testing, DNA testing, background screening, and related compliance services. Multiple service lines diversify income within a single client base.",
    },
    {
      key: "recurring",
      icon: "refresh",
      title: "Recurring Employer Relationships",
      description:
        "Employers with ongoing compliance programs require testing on a continuing basis. Established accounts produce repeat engagements rather than one-time transactions.",
    },
  ],
  customers: [
    {
      key: "transportation",
      icon: "truck",
      name: "Transportation",
      description: "DOT-regulated carriers with mandated testing programs",
    },
    {
      key: "construction",
      icon: "hard-hat",
      name: "Construction",
      description: "Site-safety and pre-employment screening requirements",
    },
    {
      key: "manufacturing",
      icon: "factory",
      name: "Manufacturing",
      description: "Workplace safety programs and post-incident testing",
    },
    {
      key: "healthcare",
      icon: "stethoscope",
      name: "Healthcare",
      description: "Credentialing and employee screening obligations",
    },
    {
      key: "staffing",
      icon: "users",
      name: "Staffing",
      description: "High-volume pre-placement screening for agencies",
    },
    {
      key: "government",
      icon: "landmark",
      name: "Government",
      description: "Contract-driven compliance and screening standards",
    },
    {
      key: "employers",
      icon: "briefcase",
      name: "Employers",
      description: "Workforce testing policies across industries",
    },
    {
      key: "individuals",
      icon: "home",
      name: "Individuals & Families",
      description: "Personal DNA, drug and background screening needs",
    },
  ],
  financial: {
    statementLabel: "2025 Profit & Loss",
    pnl: [
      { key: "sales", label: "Sales", amount: "$889,003", percentOfSales: "100%", variant: "revenue" },
      { key: "cogs", label: "Cost of Goods Sold", amount: "$21,611", percentOfSales: "2%", variant: "expense" },
      { key: "labor", label: "Labor Cost", amount: "$436,703", percentOfSales: "49%", variant: "expense" },
      { key: "rent", label: "Rent", amount: "$26,840", percentOfSales: "3%", variant: "expense" },
      { key: "other", label: "Other Costs", amount: "$9,719", percentOfSales: "1%", variant: "expense" },
      { key: "total-expenses", label: "Total Expenses", amount: "$494,873", percentOfSales: "56%", variant: "subtotal" },
      { key: "net-profit", label: "Net Profit", amount: "$394,130", percentOfSales: "44%", variant: "total" },
      { key: "royalty", label: "Royalty Fee (10%)", amount: "($88,900)", percentOfSales: "10%", variant: "deduction" },
      { key: "net-after-royalty", label: "Net Profit After Royalty", amount: "$305,230", percentOfSales: "34%", variant: "result" },
    ],
    disclaimer:
      "Financial performance information is contained in Item 19 of the franchisor's Franchise Disclosure Document. Individual results vary, and a franchisee's results may differ from the reported figures.",
  },
  snapshot: {
    entries: [
      { key: "industry", label: "Industry", value: "Medical" },
      { key: "model", label: "Business Model", value: "Mobile / Home-Based / Office" },
      { key: "investment", label: "Investment", value: "$67,850–$287,650", emphasize: true },
      { key: "liquidity", label: "Minimum Liquidity", value: "$50,000", emphasize: true },
      { key: "net-worth", label: "Minimum Net Worth", value: "$200,000", emphasize: true },
      { key: "auv", label: "Average Unit Volume", value: "$961,764", emphasize: true },
    ],
    item19: "Available",
    primaryCustomers: [
      "Employers",
      "Transportation",
      "Construction",
      "Healthcare",
      "Government",
      "Staffing Agencies",
    ],
  },
  documents: [
    {
      key: "presentation",
      title: "CMDT Franchise Opportunity Presentation",
      format: "24-page PDF",
      contents: [
        "Business overview",
        "Leadership",
        "Operations",
        "Industry",
        "Financial information",
      ],
      href: process.env.NEXT_PUBLIC_CMDT_PRESENTATION_URL,
      ctaLabel: "View Presentation",
    },
    {
      key: "one-sheet",
      title: "CMDT Opportunity One Sheet",
      format: "PDF",
      contents: [
        "Investment Summary",
        "Business Model",
        "Territory",
        "Financial Requirements",
      ],
      href: process.env.NEXT_PUBLIC_CMDT_ONE_SHEET_URL,
      ctaLabel: "View One Sheet",
    },
  ],
};

/** The profile shown on the Opportunity Overview page (one brand in V1). */
export function getOpportunityProfile(): OpportunityProfile {
  return CMDT_PROFILE;
}
