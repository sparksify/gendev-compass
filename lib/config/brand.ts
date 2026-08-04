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
  legalDisclaimer: string;
  estimatedTimeMinutes: number;
}

export const brand: BrandConfig = {
  brandName: process.env.NEXT_PUBLIC_BRAND_NAME ?? "GenDev",
  productName: "GenDev Compass",
  tagline: process.env.NEXT_PUBLIC_BRAND_TAGLINE ?? "Your Franchise Partner",
  portalLabel: "Private Investor Portal",
  logoPath: "/logo.svg",
  advisorName: process.env.NEXT_PUBLIC_ADVISOR_NAME ?? "Darko",
  advisorTitle: process.env.NEXT_PUBLIC_ADVISOR_TITLE ?? "SVP, Franchise Operations, GenDev",
  advisorPhone: process.env.NEXT_PUBLIC_ADVISOR_PHONE ?? "(416) 802-2484",
  advisorEmail: process.env.NEXT_PUBLIC_ADVISOR_EMAIL ?? "darko@frangendev.com",
  advisorPhotoPath: "/advisor.webp",
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "support@example.com",
  privacyPolicyUrl: process.env.NEXT_PUBLIC_PRIVACY_POLICY_URL ?? "#",
  termsUrl: process.env.NEXT_PUBLIC_TERMS_URL ?? "#",
  legalDisclaimer:
    "[Insert approved investment and risk disclaimer here. This portal does not constitute an offer to sell securities or a guarantee of returns.]",
  estimatedTimeMinutes: 30,
};
