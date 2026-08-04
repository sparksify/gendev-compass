import { getStore } from "@/lib/store";
import { getPortalState } from "@/lib/portal/getPortalState";
import { statusRank } from "@/lib/store/types";
import { trackEvent } from "@/lib/portal/events";
import type { LeadRecord } from "@/types/lead";
import type { QuestionnaireRecord } from "@/types/questionnaire";
import type { PortalState, VideoProgressRecord } from "@/types/portal";

export interface PortalContext {
  lead: LeadRecord;
  videoProgress: VideoProgressRecord | null;
  questionnaire: QuestionnaireRecord | null;
  state: PortalState;
}

/**
 * Resolves a portal token into everything a portal page needs, stamping the
 * first-open timestamp on the way through. Returns null for invalid tokens.
 */
export async function loadPortalContext(
  token: string,
  options: { trackOpen?: boolean } = {},
): Promise<PortalContext | null> {
  if (!token || token.length < 16 || token.length > 128) return null;

  const store = getStore();
  let lead = await store.getLeadByToken(token);
  if (!lead) return null;

  if (options.trackOpen !== false && !lead.portal_first_opened_at) {
    lead = await store.updateLead(lead.id, {
      portal_first_opened_at: new Date().toISOString(),
      ...(statusRank(lead.status) < statusRank("portal_opened")
        ? { status: "portal_opened" as const }
        : {}),
    });
    await trackEvent(lead, "portal_opened", null);
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
  };
}
