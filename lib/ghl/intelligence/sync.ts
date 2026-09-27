import { getStore } from "@/lib/store";
import { uploadQuestionnairePdfToGhl } from "@/lib/ghl/questionnaireUpload";
import { GhlClient, GhlHttpError } from "./client";
import { getIntelligenceFields } from "./fields";
import { noteHtml, projectIntelligence, questionnaireNotes } from "./project";
import type { IntelligenceState } from "./types";

type Note = { id: string; body: string };

export async function syncIntelligence(claim: IntelligenceState, client = new GhlClient()) {
  const store = getStore();
  const lead = await store.getLeadById(claim.lead_id);
  if (!lead) throw new Error("Compass lead no longer exists");
  const [events, video, questionnaire, submissions, appointments] = await Promise.all([
    store.getEventsForLead(lead.id), store.getVideoProgress(lead.id), store.getQuestionnaire(lead.id),
    store.getSubmissionsForLead(lead.id), store.getAppointmentsForLead(lead.id),
  ]);
  const external = { ...claim.external, noteIds: { ...claim.external.noteIds }, pendingCreates: { ...claim.external.pendingCreates } };
  const checkpoint = () => store.checkpointIntelligence(claim, external);
  const projection = projectIntelligence({ lead, events, video, questionnaire, submissions, appointments }, external.rank);
  let contact;
  if (external.contactId) {
    if (external.locationId !== client.locationId) throw new Error("Stored CRM target belongs to a different HighLevel location; reconcile before syncing");
    contact = await client.contact(external.contactId);
    if (contact.email?.trim().toLowerCase() !== lead.email.trim().toLowerCase()) throw new Error("Stored CRM target email no longer matches the Compass lead; reconcile before syncing");
  } else {
    contact = await client.resolveContact(lead);
  }
  external.contactId = contact.id; external.locationId = client.locationId;
  await checkpoint();
  const fields = await getIntelligenceFields(client);
  const base = `/contacts/${encodeURIComponent(contact.id)}`;

  async function createOnce<T>(marker: string, path: string, body: unknown): Promise<T> {
    if (external.pendingCreates![marker]) throw new Error(`Ambiguous prior CRM create (${marker}); awaiting reconciliation`);
    external.pendingCreates![marker] = true; await checkpoint();
    try { return await client.request<T>(path, "POST", body); }
    catch (error) {
      // A definite rejection can safely retry. Network failures, timeouts,
      // and server errors might have committed: leave the reconciliation flag.
      if (error instanceof GhlHttpError && error.status >= 400 && error.status < 500 && error.status !== 408) {
        delete external.pendingCreates![marker]; await checkpoint();
      }
      throw error;
    }
  }

  const notes = (await client.request<{ notes: Note[] }>(`${base}/notes`)).notes;
  async function upsertNote(marker: string, text: string) {
    const matches = notes.filter(n => n.body.includes(marker));
    if (external.noteIds[marker] && !matches.some(n => n.id === external.noteIds[marker])) throw new Error(`Known Compass note missing or marker edited (${marker}); reconcile before retry`);
    if (matches.length > 1) throw new Error(`Duplicate Compass notes (${marker}); reconcile before retry`);
    const body = noteHtml(`${marker}\n${text}`);
    if (matches[0]) {
      if (matches[0].body !== body) await client.request(`${base}/notes/${matches[0].id}`, "PUT", { body });
      external.noteIds[marker] = matches[0].id;
      delete external.pendingCreates![marker]; await checkpoint(); return matches[0].id;
    }
    // HighLevel has no documented idempotency key for create-note/task. After
    // an ambiguous POST, reconcile by marker; never blindly create a second.
    const created = await createOnce<{ note: Note }>(marker, `${base}/notes`, { body });
    if (!created.note?.id) throw new Error("HighLevel note response missing ID");
    notes.push(created.note); external.noteIds[marker] = created.note.id; delete external.pendingCreates![marker]; await checkpoint(); return created.note.id;
  }

  if (projection.bridgeText) {
    // Field holds the complete latest short assessment. Native note also provides
    // a readable full-size record when the narrow panel is inconvenient.
    external.bridgeNoteId = await upsertNote(`[Compass bridge ${lead.id}]`, projection.bridgeText);
    await checkpoint();
  }
  if (projection.submission) {
    const chunks = questionnaireNotes(projection.submission);
    const ids: string[] = [];
    for (const [index, chunk] of chunks.entries()) ids.push(await upsertNote(
      `[Compass questionnaire ${lead.id} ${projection.submission.id} part ${index + 1}/${chunks.length}]`, chunk));
    external.questionnaireNoteIds = ids; await checkpoint();
  }

  await checkpoint();

  if (projection.tags.length) await client.request(`${base}/tags`, "POST", { tags: projection.tags });
  // Upload is independently retried. Complete notes and operational tasks are
  // available even when file-upload scopes or storage are temporarily broken.
  let pdfError: string | undefined;
  if (projection.submission) {
    const attachmentPresent = JSON.stringify(contact.customFields ?? []).includes(`compass-questionnaire-${projection.submission.id}.pdf`);
    if (external.pdfSubmissionId !== projection.submission.id || !attachmentPresent) {
      const result = await uploadQuestionnairePdfToGhl(lead, contact.id);
      if (result.ok) { external.pdfSubmissionId = projection.submission.id; delete external.pdfError; }
      else { pdfError = result.error ?? "PDF sync failed"; external.pdfError = pdfError; }
      await checkpoint();
    }
    projection.fields["contact.compass_investor_questionnaire"] = `Complete — ${projection.submission.submitted_at}. Full answers: Compass questionnaire notes. CQ Upload PDF: ${external.pdfSubmissionId === projection.submission.id ? "attachment verified" : "pending / retrying"}.`;
  }
  await client.request(base, "PUT", { customFields: Object.entries(projection.fields).map(([key, value]) => ({ id: fields.get(key)!.id, field_value: value })) });
  external.rank = projection.rank; await checkpoint();
  if (questionnaire && !projection.submission) throw new Error("Questionnaire responses exist but versioned answer snapshot is missing");
  if (pdfError) throw new Error(pdfError);
}

export async function runIntelligenceSync(limit = 5) {
  if (process.env.GHL_COMPASS_ENABLED !== "true") return { enabled: false, synced: 0, failed: 0 };
  const store = getStore(); let synced = 0; let failed = 0;
  const deadline = Date.now() + 240_000;
  for (let i = 0; i < limit && Date.now() < deadline; i++) {
    const claim = await store.claimIntelligence();
    if (!claim) break;
    try { await syncIntelligence(claim); await store.finishIntelligence(claim); synced++; }
    catch (error) {
      const message = error instanceof Error ? error.message : "Unknown CRM sync failure";
      await store.finishIntelligence(claim, message); failed++;
      console.error(`[compass-sync] lead ${claim.lead_id}: ${message}`);
    }
  }
  return { enabled: true, synced, failed };
}
