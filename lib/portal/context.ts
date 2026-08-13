import { getStore } from "@/lib/store";
import { getPortalState } from "@/lib/portal/getPortalState";
import { statusRank } from "@/lib/store/types";
import { trackEvent, type TrackEventResult } from "@/lib/portal/events";
import { ensureLeadDomainChain } from "@/lib/domain/chain";
import type { LeadRecord } from "@/types/lead";
import type { QuestionnaireRecord } from "@/types/questionnaire";
import type { PortalState, VideoProgressRecord } from "@/types/portal";
import type {
  BrandRecord,
  ClientRecord,
  OpportunityRecord,
  OrganizationRecord,
  ProfileRecord,
} from "@/types/domain";

export interface PortalContext {
  lead: LeadRecord;
  videoProgress: VideoProgressRecord | null;
  questionnaire: QuestionnaireRecord | null;
  state: PortalState;
  /**
   * True during the prospect's first session: the first-open timestamp was
   * stamped by this request or within the last 30 minutes. Lets pages greet
   * with "Welcome" instead of "Welcome back" without flipping mid-session.
   */
  firstVisit: boolean;
  /**
   * Platform domain context. Resolved (and repaired if missing) from the
   * lead on every load; null only if chain resolution failed entirely — the
   * legacy portal experience keeps working from the lead alone in that case.
   */
  organization: OrganizationRecord | null;
  client: ClientRecord | null;
  opportunity: OpportunityRecord | null;
  brand: BrandRecord | null;
  advisor: ProfileRecord | null;
  /** Only set on the load that actually fires portal_opened — the browser-side tracking payload to push (spec §9: same event_id server+browser). */
  openEventTracking: TrackEventResult | null;
}

/**
 * Resolves a portal token into everything a portal page needs, stamping the
 * first-open timestamp on the way through. Returns null for invalid tokens.
 *
 * Portal tokens remain lead-based (existing links keep working); the lead's
 * organization / client / primary opportunity / brand are loaded around it.
 */
export async function loadPortalContext(
  token: string,
  options: { trackOpen?: boolean } = {},
): Promise<PortalContext | null> {
  if (!token || token.length < 16 || token.length > 128) return null;

  const store = getStore();
  let lead = await store.getLeadByToken(token);
  if (!lead) return null;

  // Resolve (or repair) the domain chain before tracking so events carry
  // organization/opportunity links. Chain failure never blocks the portal.
  let organization: OrganizationRecord | null = null;
  let client: ClientRecord | null = null;
  let opportunity: OpportunityRecord | null = null;
  let brand: BrandRecord | null = null;
  let advisor: ProfileRecord | null = null;
  try {
    const chain = await ensureLeadDomainChain(lead);
    lead = chain.lead;
    organization = chain.organization;
    client = chain.client;
    opportunity = chain.opportunity;
    brand = chain.brand;
    if (chain.opportunity.assigned_advisor_profile_id) {
      advisor = await store.getProfileById(chain.opportunity.assigned_advisor_profile_id);
    }
  } catch (error) {
    console.error(`[portal] domain chain resolution failed for lead ${lead.id}:`, error);
  }

  const FIRST_VISIT_WINDOW_MS = 30 * 60_000;
  const firstVisit =
    !lead.portal_first_opened_at ||
    Date.now() - Date.parse(lead.portal_first_opened_at) < FIRST_VISIT_WINDOW_MS;

  let openEventTracking: TrackEventResult | null = null;
  if (options.trackOpen !== false && !lead.portal_first_opened_at) {
    lead = await store.updateLead(lead.id, {
      portal_first_opened_at: new Date().toISOString(),
      ...(statusRank(lead.status) < statusRank("portal_opened")
        ? { status: "portal_opened" as const }
        : {}),
    });
    openEventTracking = await trackEvent(lead, "portal_opened", null);
  }

  const [videoProgress, questionnaire] = await Promise.all([
    store.getVideoProgress(lead.id),
    store.getQuestionnaire(lead.id),
  ]);

  return {
    lead,
    videoProgress,
    questionnaire,
    state: getPortalState(lead, videoProgress, questionnaire),
    firstVisit,
    organization,
    client,
    opportunity,
    brand,
    advisor,
    openEventTracking,
  };
}
