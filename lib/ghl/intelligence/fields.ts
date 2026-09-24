import type { GhlClient } from "./client";

/** Exactly eight primary fields; answer archive stays in its own folder. */
export const INTELLIGENCE_FIELDS = [
  { key: "contact.compass_engagement_status", name: "Compass Engagement Status", type: "TEXT" },
  { key: "contact.compass_why_this_lead_matters", name: "Compass Why This Lead Matters", type: "LARGE_TEXT" },
  { key: "contact.compass_next_action", name: "Compass Next Action", type: "TEXT" },
  { key: "contact.compass_bridge_fit_assessment", name: "Compass Bridge Fit Assessment", type: "TEXT" },
  { key: "contact.compass_overview_video", name: "Compass Overview Video", type: "TEXT" },
  { key: "contact.compass_investor_questionnaire", name: "Compass Investor Questionnaire", type: "LARGE_TEXT" },
  { key: "contact.compass_qualification_summary", name: "Compass Qualification Summary", type: "LARGE_TEXT" },
  { key: "contact.compass_last_meaningful_activity", name: "Compass Last Meaningful Activity", type: "TEXT" },
] as const;
export const ANSWERS_FIELD = { key: "contact.compass_bridge_answers", name: "Compass Bridge Answers", type: "LARGE_TEXT" } as const;
export interface GhlField { id: string; fieldKey: string; name: string; dataType: string; parentId?: string; }
export async function getIntelligenceFields(client: GhlClient): Promise<Map<string, GhlField>> {
  const response = await client.request<{ customFields: GhlField[] }>(`/locations/${client.locationId}/customFields?model=contact`);
  const map = new Map<string, GhlField>();
  for (const definition of [...INTELLIGENCE_FIELDS, ANSWERS_FIELD]) {
    const found = response.customFields.filter(f => f.fieldKey === definition.key);
    if (found.length !== 1 || found[0].dataType !== definition.type) throw new Error(`Configure ${definition.key} as ${definition.type} in HighLevel before enabling sync`);
    map.set(definition.key, found[0]);
  }
  return map;
}
