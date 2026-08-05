import type { TerritoryResultStatus } from "@/types/territory";

export type CtaAction =
  | "requestReview"
  | "checkAnother"
  | "exploreNearby"
  | "viewOpportunities"
  | "contactAdvisor";

export interface CtaButton {
  label: string;
  action: CtaAction;
}

export interface CtaSet {
  primary?: CtaButton;
  secondary?: CtaButton;
}

/** Which buttons appear under a result, per spec §"TERRITORY RESULT STATES". */
export function ctaForStatus(status: TerritoryResultStatus): CtaSet {
  switch (status) {
    case "AVAILABLE":
      return {
        primary: { label: "Request Territory Review", action: "requestReview" },
        secondary: { label: "Check Another Area", action: "checkAnother" },
      };
    case "PARTIALLY_AVAILABLE":
      return {
        primary: { label: "Request Detailed Review", action: "requestReview" },
        secondary: { label: "Explore Nearby Markets", action: "exploreNearby" },
      };
    case "UNAVAILABLE":
      return {
        primary: { label: "Explore Nearby Markets", action: "exploreNearby" },
        secondary: { label: "Ask GenDev About This Area", action: "requestReview" },
      };
    case "STATE_RESTRICTED":
      return {
        primary: { label: "View Other Opportunities", action: "viewOpportunities" },
        secondary: { label: "Contact My Advisor", action: "contactAdvisor" },
      };
    case "MANUAL_REVIEW":
      return { primary: { label: "Request Manual Review", action: "requestReview" } };
    default:
      return {};
  }
}
