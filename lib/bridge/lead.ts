import { getStore } from "@/lib/store";
import { trackEvent } from "@/lib/portal/events";
import { recordLeadEvent } from "@/lib/domain/activities";
import { ensureLeadDomainChain } from "@/lib/domain/chain";
import { LIQUID_CAPITAL_RANGES } from "@/types/questionnaire";
import type { LeadRecord } from "@/types/lead";
import {
  BRIDGE_ASSESSMENT_VERSION,
  answerSnapshot,
  assessFit,
  type FitLevel,
  type KnownLeadAssessmentInput,
} from "@/lib/bridge/assessment";

/**
 * Resolves a bridge token (the same portal token every lead already has)
 * into its lead, repairing the domain chain on the way and recording the
 * first bridge visit. Returns null for an invalid or unknown token.
 */
export async function resolveBridgeLead(token: string): Promise<LeadRecord | null> {
  if (!token || token.length < 16 || token.length > 128) return null;
  const store = getStore();
  let lead = await store.getLeadByToken(token);
  if (!lead) return null;

  try {
    lead = (await ensureLeadDomainChain(lead)).lead;
  } catch (error) {
    console.error(`[bridge] domain chain resolution failed for lead ${lead.id}:`, error);
  }

  try {
    const events = await store.getEventsForLead(lead.id);
    if (!events.some((e) => e.event_name === "bridge_opened")) {
      await trackEvent(lead, "bridge_opened", null, "/watch");
    }
  } catch (error) {
    console.error(`[bridge] failed to record bridge_opened for lead ${lead.id}:`, error);
  }

  return lead;
}

/**
 * Attaches a completed fit assessment to a lead — used both when the
 * assessment created the lead (/watch) and when the lead already existed
 * (/watch/[token]). Carries the answers onto the record where the portal
 * and advisors already look, without ever overwriting what is there:
 *
 * - state / initial_liquid_capital: filled only when empty
 * - questionnaire draft: seeded with the location (and liquid capital when
 *   it is one of the questionnaire's own ranges) so nothing is typed twice;
 *   an existing draft wins, and a completed questionnaire is left alone
 * - full answers: recorded first-party only (bridge_assessment_submitted)
 * - a coarse completion signal (bridge_assessment_completed) goes through
 *   the tracked pipeline for GTM / Meta / PostHog
 */
export async function applyAssessmentToLead(
  lead: LeadRecord,
  input: KnownLeadAssessmentInput,
): Promise<{ lead: LeadRecord; fit: FitLevel }> {
  const store = getStore();
  const nowIso = new Date().toISOString();
  const fit = assessFit(input);
  const isPortalCapitalRange = LIQUID_CAPITAL_RANGES.some((r) => r.value === input.liquidCapital);

  const seed = {
    city: input.city,
    state: input.state,
    postalCode: input.zip,
    ...(isPortalCapitalRange ? { liquidCapital: input.liquidCapital } : {}),
  };

  let updated = lead;
  try {
    updated = await store.updateLead(lead.id, {
      last_activity_at: nowIso,
      ...(lead.state ? {} : { state: input.state }),
      ...(!lead.initial_liquid_capital && isPortalCapitalRange
        ? { initial_liquid_capital: input.liquidCapital }
        : {}),
      ...(lead.questionnaire_completed_at
        ? {}
        : {
            questionnaire_draft: { ...seed, ...(lead.questionnaire_draft ?? {}) },
            questionnaire_draft_saved_at: nowIso,
          }),
    });
  } catch (error) {
    console.error(`[bridge] lead update failed for lead ${lead.id}:`, error);
  }

  try {
    await recordLeadEvent(
      updated,
      "bridge_assessment_submitted",
      {
        version: BRIDGE_ASSESSMENT_VERSION,
        fit,
        answers: answerSnapshot(input),
      },
      "/watch",
    );
  } catch (error) {
    console.error(`[bridge] failed to store assessment answers for lead ${updated.id}:`, error);
  }

  await trackEvent(updated, "bridge_assessment_completed", { fit }, "/watch");

  return { lead: updated, fit };
}
