import { createHash, randomUUID } from "crypto";
import type { IntelligenceState } from "./types";

/** Development parity with transactional database source triggers. No answers
 * are copied into the outbox, only a digest of the existing source records. */
export function refreshDevQueue(data: {
  leads: Array<{ id: string; qualification_result: unknown; booked_at: unknown }>;
  portal_events: Array<{ lead_id: string; event_name: string }>;
  video_progress: Array<{ lead_id: string; verified_watch?: unknown }>;
  questionnaire_responses: Array<{ lead_id: string }>;
  questionnaire_submissions: Array<{ id: string; lead_id: string }>;
  questionnaire_answers: Array<{ submission_id: string }>;
  appointments: Array<{ lead_id: string }>;
  compass_intelligence_sync: IntelligenceState[];
}) {
  for (const lead of data.leads) {
    const submissions = data.questionnaire_submissions.filter(x => x.lead_id === lead.id);
    const eventKey = createHash("sha256").update(JSON.stringify([
      lead.qualification_result, lead.booked_at,
      data.portal_events.filter(x => x.lead_id === lead.id && ["bridge_assessment_submitted", "bridge_opened", "portal_opened"].includes(x.event_name)),
      data.video_progress.find(x => x.lead_id === lead.id)?.verified_watch,
      data.questionnaire_responses.filter(x => x.lead_id === lead.id), submissions,
      data.questionnaire_answers.filter(x => submissions.some(s => s.id === x.submission_id)),
      data.appointments.filter(x => x.lead_id === lead.id),
    ])).digest("hex");
    const state = data.compass_intelligence_sync.find(x => x.lead_id === lead.id);
    if (state) {
      if (state.event_key !== eventKey) { state.event_key = eventKey; state.revision++; }
    } else data.compass_intelligence_sync.push({ lead_id: lead.id, event_key: eventKey, revision: 1,
      synced_revision: 0, attempts: 0, last_error: null, next_attempt_at: new Date().toISOString(),
      lease_token: null, lease_until: null, external: {} });
  }
}
export function claimDevQueue(rows: IntelligenceState[]): IntelligenceState | null {
  const now = Date.now();
  const row = rows.find(x => x.revision > x.synced_revision && Date.parse(x.next_attempt_at) <= now && (!x.lease_until || Date.parse(x.lease_until) < now));
  if (!row) return null;
  row.lease_token = randomUUID(); row.lease_until = new Date(now + 600_000).toISOString(); row.attempts++;
  return structuredClone(row);
}
