export interface IntelligenceState {
  lead_id: string;
  event_key: string;
  revision: number;
  synced_revision: number;
  attempts: number;
  retry_count?: number;
  last_error: string | null;
  next_attempt_at: string;
  lease_token: string | null;
  lease_until: string | null;
  external: IntelligenceExternal;
}
export interface IntelligenceExternal {
  locationId?: string;
  contactId?: string;
  bridgeNoteId?: string;
  questionnaireNoteIds?: string[];
  taskId?: string;
  taskLevel?: number;
  rank?: number;
  pdfSubmissionId?: string;
  pdfError?: string;
  noteIds?: Record<string, string>;
  pendingCreates?: Record<string, boolean>;
  taskSuppressed?: boolean;
}
export type IntelligenceCheckpoint = Pick<IntelligenceState, "lead_id" | "lease_token">;
