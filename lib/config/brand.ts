/**
 * Brand and portal presentation settings.
 *
 * All user-visible brand copy lives here so a second brand can be launched
 * by changing environment variables (or this file) without touching pages.
 */
export interface BrandConfig {
  brandName: string;
  /** Product name of the portal itself. */
  productName: string;
  /** Company line under the wordmark in the advisor sidebar. */
  orgName: string;
  /** Small tagline under the wordmark (comp: "YOUR FRANCHISE PARTNER"). */
  tagline: string;
  portalLabel: string;
  logoPath: string;
  advisorName: string;
  advisorTitle: string;
  advisorPhone: string;
  advisorEmail: string;
  advisorPhotoPath: string;
  supportEmail: string;
  privacyPolicyUrl: string;
  termsUrl: string;
  legalNoticeTitle: string;
  /** Footer legal notice paragraphs, rendered in order. */
  legalNotice: string[];
  estimatedTimeMinutes: number;
  /** IANA time zone used to display timestamps (stored in UTC) to prospects. */
  timeZone: string;
}

export const brand: BrandConfig = {
  brandName: process.env.NEXT_PUBLIC_BRAND_NAME ?? "GenDev",
  productName: "GenDev Compass",
  orgName: process.env.NEXT_PUBLIC_ORG_NAME ?? "GenDev Capital",
  tagline: process.env.NEXT_PUBLIC_BRAND_TAGLINE ?? "Your Franchise Partner",
  portalLabel: "Private Investor Portal",
  logoPath: "/logo.svg",
  advisorName: process.env.NEXT_PUBLIC_ADVISOR_NAME ?? "Darko",
  advisorTitle: process.env.NEXT_PUBLIC_ADVISOR_TITLE ?? "SVP, Franchise Operations, GenDev",
  advisorPhone: process.env.NEXT_PUBLIC_ADVISOR_PHONE ?? "(416) 802-2484",
  advisorEmail: process.env.NEXT_PUBLIC_ADVISOR_EMAIL ?? "darko@frangendev.com",
  advisorPhotoPath: "/advisor.webp",
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "help@gendevcompass.com",
  privacyPolicyUrl: process.env.NEXT_PUBLIC_PRIVACY_POLICY_URL ?? "#",
  termsUrl: process.env.NEXT_PUBLIC_TERMS_URL ?? "#",
  legalNoticeTitle: "Franchise Disclosure & Legal Notice",
  legalNotice: [
    'GenDev is a franchise sales organization ("FSO") that represents independent franchisors and assists prospective franchisees in evaluating franchise opportunities. The information provided on this website is for general informational purposes only and is not intended to constitute an offer to sell, or the solicitation of an offer to buy, a franchise.',
    'An offer to sell a franchise is made only by the applicable franchisor through the delivery of its current Franchise Disclosure Document ("FDD") and only in states or jurisdictions where the franchisor is registered, exempt from registration, or otherwise legally authorized to offer and sell franchises.',
    "Some states require franchisors to register their franchise offerings before advertising, offering, or selling franchises within those states. Nothing contained on this website should be interpreted as an offer or solicitation in any jurisdiction where such offer or sale would be unlawful.",
    "GenDev does not guarantee the accuracy, completeness, or timeliness of information supplied by the franchisors it represents. All descriptions of franchise systems, investment ranges, financial requirements, operational details, market opportunities, and other information are believed to be accurate but should be independently verified through the applicable Franchise Disclosure Document and discussions with the franchisor.",
    "Any financial information, investment estimates, sales figures, earnings examples, or performance information presented on this website is provided solely for informational purposes. Actual results vary significantly based on numerous factors, including the franchisee's experience, location, management, market conditions, capitalization, and operational execution. No representation is made that any franchisee will achieve the same or similar results unless expressly stated in the applicable Franchise Disclosure Document.",
    "Prospective franchisees are strongly encouraged to conduct their own due diligence and consult with qualified legal, accounting, and financial advisors before making any investment decision. Purchasing a franchise is a significant business decision and should be based upon careful review of the Franchise Disclosure Document and other relevant information.",
    "GenDev may receive compensation from franchisors for introducing qualified prospective franchisees. Such compensation does not increase the purchase price of a franchise and does not affect the franchise fees paid by a purchaser.",
    "Use of this website does not create a broker-client, fiduciary, agency, attorney-client, or other professional relationship between you and GenDev. Submission of information through this website does not guarantee qualification for any franchise opportunity, nor does it obligate either party to proceed with a transaction.",
  ],
  estimatedTimeMinutes: 30,
  timeZone: process.env.NEXT_PUBLIC_BRAND_TIMEZONE ?? "America/Chicago",
};
