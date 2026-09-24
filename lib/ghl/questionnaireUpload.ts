import { getStore } from "@/lib/store";
import { getGhlConfig } from "@/lib/config/fdd";
import { createHash } from "crypto";
import { GhlClient } from "./intelligence/client";
import { renderQuestionnairePdf } from "@/lib/advisor/questionnairePdf";
import type { LeadRecord } from "@/types/lead";

/**
 * Pushes the completed-questionnaire PDF into the lead's GoHighLevel
 * contact, into the file-upload custom field `contact.cq_upload`.
 *
 * Called after a successful questionnaire submission. Fire-safe by
 * contract: any failure logs and returns a result — it must never block or
 * break the prospect's flow. Credentials never leave the server.
 *
 * The custom field is resolved by its key (not a hardcoded id) so the
 * integration survives the field being recreated in GoHighLevel.
 */

const GHL_API_BASE = "https://services.leadconnectorhq.com";
const REQUEST_TIMEOUT_MS = 10_000;
const CQ_UPLOAD_FIELD_KEY = "contact.cq_upload";

export interface QuestionnaireUploadResult {
  ok: boolean;
  contactId: string | null;
  fieldId: string | null;
  error: string | null;
}

function ghlHeaders(apiToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiToken}`,
    Version: "2021-07-28",
  };
}

async function resolveCqUploadFieldId(client: GhlClient): Promise<string> {
  const path = `/locations/${client.locationId}/customFields`;
  const result = await client.request<{ customFields: Array<{ id: string; fieldKey: string; dataType: string }> }>(`${path}?model=contact`);
  const fields = result.customFields.filter(f => f.fieldKey === CQ_UPLOAD_FIELD_KEY);
  if (fields.length > 1) throw new Error("Duplicate contact.cq_upload fields require reconciliation");
  if (fields[0]) {
    if (fields[0].dataType !== "FILE_UPLOAD") throw new Error("contact.cq_upload must be FILE_UPLOAD; existing data was not changed");
    return fields[0].id;
  }
  // Only provision a missing field; never convert or delete an existing field.
  const created = await client.request<{ customField: { id: string; fieldKey: string } }>(path, "POST", {
    name: "CQ Upload", dataType: "FILE_UPLOAD", model: "contact", acceptedFormat: [".pdf"], isMultipleFile: false,
  });
  if (created.customField?.fieldKey !== CQ_UPLOAD_FIELD_KEY) throw new Error("Created PDF field key does not match contact.cq_upload");
  return created.customField.id;
}
function containsFilename(value: unknown, filename: string): boolean {
  return JSON.stringify(value ?? "").includes(filename);
}

export async function uploadQuestionnairePdfToGhl(
  lead: LeadRecord,
  resolvedContactId?: string,
): Promise<QuestionnaireUploadResult> {
  const fail = (error: string, extra: Partial<QuestionnaireUploadResult> = {}) => {
    console.error(`[ghl/cq-upload] ${error} (lead ${lead.id})`);
    return { ok: false, contactId: null, fieldId: null, error, ...extra };
  };

  try {
    const config = getGhlConfig();
    if (!config.apiToken || !config.locationId) {
      return fail("GoHighLevel API is not configured (GHL_API_TOKEN/GHL_LOCATION_ID)");
    }

    const store = getStore();
    const [questionnaire, submissions] = await Promise.all([
      store.getQuestionnaire(lead.id),
      store.getSubmissionsForLead(lead.id).catch(() => []),
    ]);
    if (!questionnaire) {
      return fail("no completed questionnaire on record");
    }
    const latest = submissions[0] ?? null;
    if (!latest?.answers.length) return fail("Versioned questionnaire snapshot is missing; CRM copy remains pending");

    const pdf = await renderQuestionnairePdf({
      lead,
      questionnaire,
      submittedAt:
        latest?.submitted_at ?? lead.questionnaire_completed_at ?? questionnaire.created_at,
      questionnaireVersion: latest?.questionnaire_version ?? null,
      snapshot: latest.answers,
    });

    const client = new GhlClient();
    const contact = resolvedContactId ? await client.contact(resolvedContactId) : await client.resolveContact(lead);
    const contactId = contact.id;
    const fieldId = await resolveCqUploadFieldId(client);
    // Stable filename and file ID make retries reconcilable after a lost reply.
    const fileId = createHash("sha256").update(latest.id).digest("hex").slice(0,32);
    const filename = `compass-questionnaire-${latest.id}.pdf`;
    if (containsFilename(contact.customFields?.find(f => f.id === fieldId)?.value, filename)) {
      return { ok: true, contactId, fieldId, error: null };
    }

    const form = new FormData();
    // ArrayBuffer-backed copy: pdf-lib returns a Uint8Array whose buffer
    // type Blob's constructor is stricter about.
    form.append(
      `${fieldId}_${fileId}`,
      new Blob([new Uint8Array(pdf)], { type: "application/pdf" }),
      filename,
    );

    const upload = await fetch(
      `${GHL_API_BASE}/forms/upload-custom-files?contactId=${encodeURIComponent(contactId)}&locationId=${encodeURIComponent(config.locationId)}`,
      {
        method: "POST",
        headers: ghlHeaders(config.apiToken),
        body: form,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS * 2),
      },
    );
    if (!upload.ok) {
      return fail(
        `GoHighLevel file upload responded ${upload.status}`,
        { contactId, fieldId },
      );
    }

    const confirmed = await client.contact(contactId);
    if (!containsFilename(confirmed.customFields?.find(f => f.id === fieldId)?.value, filename)) {
      return fail("Upload accepted but attachment not visible on contact; retry required", { contactId, fieldId });
    }
    return { ok: true, contactId, fieldId, error: null };
  } catch (error) {
    return fail(error instanceof Error ? error.message : "unexpected upload failure");
  }
}
