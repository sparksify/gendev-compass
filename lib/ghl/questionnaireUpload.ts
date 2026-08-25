import { getStore } from "@/lib/store";
import { getGhlConfig } from "@/lib/config/fdd";
import { listMappingsForEntity } from "@/lib/domain/mappings";
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
 * integration survives the field being recreated in GoHighLevel; the id is
 * cached per server instance.
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

/** Module-scope cache: locationId -> resolved custom field id. */
const fieldIdCache = new Map<string, string>();

async function resolveCqUploadFieldId(
  apiToken: string,
  locationId: string,
): Promise<string | null> {
  const cached = fieldIdCache.get(locationId);
  if (cached) return cached;

  const response = await fetch(`${GHL_API_BASE}/locations/${locationId}/customFields?model=contact`, {
    headers: ghlHeaders(apiToken),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`GoHighLevel custom-fields lookup responded ${response.status}`);
  }
  const data = (await response.json().catch(() => null)) as {
    customFields?: Array<{ id?: string; fieldKey?: string }>;
  } | null;
  const field = data?.customFields?.find((f) => f.fieldKey === CQ_UPLOAD_FIELD_KEY);
  if (!field?.id) return null;
  fieldIdCache.set(locationId, field.id);
  return field.id;
}

/** Mapping first (intake registered the contact), else upsert by email. */
async function resolveGhlContactId(
  lead: LeadRecord,
  apiToken: string,
  locationId: string,
): Promise<string | null> {
  if (lead.client_id) {
    try {
      const mappings = await listMappingsForEntity(lead.client_id);
      const mapped = mappings.find(
        (m) => m.provider === "gohighlevel" && m.entity_type === "client",
      )?.external_id;
      if (mapped) return mapped;
    } catch {
      // Fall through to the upsert path.
    }
  }

  const response = await fetch(`${GHL_API_BASE}/contacts/upsert`, {
    method: "POST",
    headers: { ...ghlHeaders(apiToken), "Content-Type": "application/json" },
    body: JSON.stringify({
      locationId,
      firstName: lead.first_name,
      lastName: lead.last_name,
      email: lead.email,
      phone: lead.phone ?? undefined,
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`GoHighLevel contact upsert responded ${response.status}`);
  }
  const data = (await response.json().catch(() => null)) as {
    contact?: { id?: string };
  } | null;
  return data?.contact?.id ?? null;
}

export async function uploadQuestionnairePdfToGhl(
  lead: LeadRecord,
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

    const pdf = await renderQuestionnairePdf({
      lead,
      questionnaire,
      submittedAt:
        latest?.submitted_at ?? lead.questionnaire_completed_at ?? questionnaire.created_at,
      questionnaireVersion: latest?.questionnaire_version ?? null,
    });

    const [contactId, fieldId] = await Promise.all([
      resolveGhlContactId(lead, config.apiToken, config.locationId),
      resolveCqUploadFieldId(config.apiToken, config.locationId),
    ]);
    if (!contactId) return fail("could not resolve a GoHighLevel contact for the lead");
    if (!fieldId) {
      return fail(
        `custom field ${CQ_UPLOAD_FIELD_KEY} not found in location ${config.locationId}`,
        { contactId },
      );
    }

    const safeName = `${lead.first_name}-${lead.last_name}`
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const filename = `investor-qualification-${safeName || lead.id}.pdf`;

    const form = new FormData();
    // ArrayBuffer-backed copy: pdf-lib returns a Uint8Array whose buffer
    // type Blob's constructor is stricter about.
    form.append(
      fieldId,
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
      const detail = await upload.text().catch(() => "");
      return fail(
        `GoHighLevel file upload responded ${upload.status}${detail ? `: ${detail.slice(0, 300)}` : ""}`,
        { contactId, fieldId },
      );
    }

    return { ok: true, contactId, fieldId, error: null };
  } catch (error) {
    return fail(error instanceof Error ? error.message : "unexpected upload failure");
  }
}
