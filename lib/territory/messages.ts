import type { StateEligibilityStatus, TerritoryResultStatus } from "@/types/territory";
import { stateName } from "@/lib/geocoding/states";

export interface MessageContext {
  brandName: string;
  locationLabel: string;
  stateCode: string | null;
  alternativeCount: number;
  candidateCount?: number;
  stateEligibilityStatus?: StateEligibilityStatus | null;
}

/**
 * Client-facing copy for each structured result status. This is presentation
 * only — the status itself is decided entirely by lib/territory/evaluate.ts.
 * Wording deliberately avoids ever asserting a territory is reserved,
 * awarded, or guaranteed (see the standing disclaimer in
 * components/territory/Disclaimer.tsx).
 */
export function messageForStatus(status: TerritoryResultStatus, ctx: MessageContext): string {
  const state = ctx.stateCode ? stateName(ctx.stateCode) : "that area";
  switch (status) {
    case "AVAILABLE":
      return (
        `Good news — this market appears to be available based on our current preliminary territory records. ` +
        `We evaluated the area surrounding ${ctx.locationLabel} for ${ctx.brandName}, and we did not find a direct ` +
        `conflict with a sold or reserved territory. This is an initial screening only — final availability must ` +
        `be confirmed by the GenDev team and the franchisor.`
      );
    case "PARTIALLY_AVAILABLE":
      return (
        `Parts of this market may already be committed, but there appear to be nearby areas that could still be ` +
        `available. We found overlap near ${ctx.locationLabel}, so a member of the GenDev team should review the ` +
        `market before confirming availability.`
      );
    case "UNAVAILABLE":
      return ctx.alternativeCount > 0
        ? `This specific market appears to overlap with a territory that is already sold or reserved. That doesn't ` +
            `necessarily mean the broader region is closed — we found ${ctx.alternativeCount} nearby ` +
            `${ctx.alternativeCount === 1 ? "area" : "areas"} that may still be worth exploring.`
        : `This specific market appears to overlap with a territory that is already sold or reserved. We didn't ` +
            `find a nearby alternative in our current records — a member of the GenDev team can help you look ` +
            `further out or at a different region.`;
    case "STATE_RESTRICTED":
      return (
        `${ctx.brandName} is not currently available for franchise sales in ${state} through this platform. ` +
        `Franchise registration and exemption requirements vary by state. A member of the GenDev team can ` +
        `confirm whether this market may become available later or whether another opportunity may be a better fit.`
      );
    case "MANUAL_REVIEW":
      return (
        `This market needs a closer review. We found the area you entered, but the current territory ` +
        `configuration requires confirmation from the GenDev team before we can provide a preliminary result.`
      );
    case "LOCATION_NOT_FOUND":
      return ctx.candidateCount && ctx.candidateCount > 1
        ? `I found more than one location matching that search. Please choose the area you meant.`
        : `I couldn't find that location. Try a city and state (e.g. "Dallas, Texas"), or a 5-digit ZIP code.`;
    case "BRAND_NOT_CONFIGURED":
      return `Territory screening isn't set up for this opportunity yet. A member of the GenDev team can help directly.`;
    default:
      return "We couldn't complete this check. Please try again.";
  }
}

export const STANDING_DISCLAIMER =
  "Territory results are preliminary and provided for informational purposes only. Availability may change and " +
  "is subject to franchisor approval, applicable franchise registration requirements, the Franchise Disclosure " +
  "Document, and final territory documentation. A territory is not reserved or awarded until confirmed in " +
  "writing by the franchisor or its authorized representative.";

export const MAP_DISCLAIMER = "Preliminary evaluation area — not a final territory boundary.";
