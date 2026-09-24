import { getStore } from "@/lib/store";
import { uploadQuestionnairePdfToGhl } from "@/lib/ghl/questionnaireUpload";
import { GhlClient, GhlHttpError } from "./client";
import { getIntelligenceFields } from "./fields";
import { noteHtml, projectIntelligence, questionnaireNotes } from "./project";
import type { IntelligenceState } from "./types";

type Note = { id: string; body: string };
type Task = { id: string; title: string; body?: string; completed: boolean; dueDate?: string; assignedTo?: string };

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
  const contact = await client.resolveContact(lead);
  if (external.contactId && (external.contactId !== contact.id || external.locationId !== client.locationId)) throw new Error("CRM target changed; reconcile stored IDs before syncing");
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

  const tasks = (await client.request<{ tasks: Task[] }>(`${base}/tasks`)).tasks;
  const marker = `[Compass follow-up ${lead.id}]`;
  const matches = tasks.filter(t => t.body?.includes(marker));
  if (matches.length > 1) throw new Error("Duplicate Compass follow-up tasks require reconciliation");
  const task = matches[0];
  if (external.taskId && !task) throw new Error("Known Compass task is missing; reconcile before creating another");
  if (projection.booked) {
    if (task && !task.completed) await client.request(`${base}/tasks/${task.id}`, "PUT", {
      title: task.title, body: `${marker}\nSuppressed: appointment booked. Review answers before the appointment.`,
      completed: true, dueDate: task.dueDate ?? new Date().toISOString(), assignedTo: task.assignedTo,
    });
    external.taskSuppressed = true;
  } else if (projection.taskLevel && (!task || !task.completed || projection.taskLevel > (external.taskLevel ?? 0) || external.taskSuppressed)) {
    const policy = process.env.GHL_COMPASS_OWNER_POLICY ?? "contact-owner";
    if (!["contact-owner", "darko"].includes(policy)) throw new Error("GHL_COMPASS_OWNER_POLICY must be contact-owner or darko");
    const owner = policy === "darko" ? process.env.GHL_COMPASS_DARKO_USER_ID : contact.assignedTo || process.env.GHL_COMPASS_DARKO_USER_ID;
    if (!owner) throw new Error("Configure a HighLevel task owner (contact owner or Darko user ID)");
    const users = await client.request<{ users: Array<{ id: string }> }>(`/users/?locationId=${client.locationId}`);
    if (!users.users.some(u => u.id === owner)) throw new Error("Configured task owner is not a user in this location");
    const upgraded = projection.taskLevel > (external.taskLevel ?? 0);
    const body = {
      title: projection.taskTitle,
      body: `${marker}\n${projection.fields["contact.compass_why_this_lead_matters"]}\nFull short answers: Compass Answers / Compass Bridge Answers and Compass bridge note. Full investor questionnaire: Compass questionnaire notes and CQ Upload when verified.`,
      completed: false, assignedTo: owner,
      dueDate: !upgraded && task?.dueDate ? task.dueDate : new Date(Date.now() + (projection.taskLevel >= 2 ? 0 : 86400_000)).toISOString(),
    };
    if (task) {
      // Preserve the completed state on replays; only a new milestone or a
      // cancelled booking can reopen this integration's own follow-up task.
      await client.request(`${base}/tasks/${task.id}`, "PUT", body);
      external.taskId = task.id;
    } else {
      const created = await createOnce<{ task: Task }>(marker, `${base}/tasks`, body);
      if (!created.task?.id) throw new Error("HighLevel task response missing ID");
      external.taskId = created.task.id;
    }
    delete external.pendingCreates![marker];
    external.taskLevel = projection.taskLevel; external.taskSuppressed = false;
  }
  if (task) { external.taskId = task.id; delete external.pendingCreates![marker]; }
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
