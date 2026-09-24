import type { PortalEventRecord } from "@/types/analytics";
import type { AnswerSnapshotEntry, FitLevel } from "@/lib/bridge/assessment";

/**
 * The fit assessment as advisors see it: read back from the lead's
 * bridge_assessment_submitted event, which is where the answers live (they
 * are recorded first-party only — see lib/bridge/lead.ts).
 */
export interface BridgeAssessmentRecord {
  submittedAt: string;
  fit: FitLevel;
  version: string | null;
  answers: AnswerSnapshotEntry[];
}

export const BRIDGE_ASSESSMENT_EVENT = "bridge_assessment_submitted";

function isEntry(value: unknown): value is AnswerSnapshotEntry {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v.key === "string" && typeof v.question === "string" && typeof v.label === "string";
}

export function assessmentFromEvent(event: PortalEventRecord): BridgeAssessmentRecord | null {
  if (event.event_name !== BRIDGE_ASSESSMENT_EVENT) return null;
  const data = event.event_data ?? {};
  const answers = Array.isArray(data.answers) ? data.answers.filter(isEntry) : [];
  return {
    submittedAt: event.occurred_at ?? event.created_at,
    fit: data.fit === "strong" ? "strong" : "standard",
    version: typeof data.version === "string" ? data.version : null,
    answers,
  };
}

/** The most recent assessment on a lead's history, or null if they never submitted one. */
export function latestBridgeAssessment(events: PortalEventRecord[]): BridgeAssessmentRecord | null {
  const latest = events
    .filter((e) => e.event_name === BRIDGE_ASSESSMENT_EVENT)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  return latest ? assessmentFromEvent(latest) : null;
}

export function answerFor(record: BridgeAssessmentRecord, key: string): string | null {
  return record.answers.find((a) => a.key === key)?.label ?? null;
}
