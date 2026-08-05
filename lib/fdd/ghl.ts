import { getGhlConfig, isGhlConfigured } from "@/lib/config/fdd";
import { devToolsEnabled, getAppUrl } from "@/lib/config/env";
import { brand } from "@/lib/config/brand";
import type { LeadRecord } from "@/types/lead";

/**
 * Server-side GoHighLevel dispatch for the FDD workflow. Credentials never
 * leave the server — the browser only ever talks to our own API routes.
 *
 * Two integration modes, in order of preference:
 *   1. API mode (GHL_API_TOKEN + GHL_LOCATION_ID): we upsert the contact with
 *      the request tag, then enroll it directly in the FDD workflow
 *      (GHL_FDD_WORKFLOW_ID) via the add-to-workflow endpoint — no trigger
 *      configuration required inside GoHighLevel. Without a workflow ID the
 *      tag alone remains available for a tag-based trigger.
 *   2. Inbound-webhook trigger (GHL_FDD_WEBHOOK_URL): we POST the request
 *      payload and the GoHighLevel workflow takes over (tags the contact,
 *      sends the FDD, notifies the advisor).
 *
 * When neither is configured and dev tools are enabled (local dev, Vercel
 * previews, explicit staging), the dispatch is simulated so the full flow
 * remains demoable with zero external services.
 */

export interface GhlDispatchResult {
  ok: boolean;
  mode: "webhook" | "api" | "simulated";
  /** GoHighLevel contact or workflow execution reference, when available. */
  workflowRef: string | null;
  /** True when this mode confirms the send synchronously (simulated only). */
  confirmedSent: boolean;
  error: string | null;
}

const GHL_API_BASE = "https://services.leadconnectorhq.com";
const DISPATCH_TIMEOUT_MS = 8000;

export function buildFddRequestPayload(
  lead: LeadRecord,
  idempotencyKey: string,
): Record<string, unknown> {
  const config = getGhlConfig();
  return {
    event: "fdd_requested",
    prospect_id: lead.id,
    location_id: config.locationId,
    workflow_id: config.workflowId,
    requested_at: lead.fdd_requested_at ?? new Date().toISOString(),
    idempotency_key: idempotencyKey,
    contact: {
      first_name: lead.first_name,
      last_name: lead.last_name,
      email: lead.email,
      phone: lead.phone,
    },
    advisor: {
      name: brand.advisorName,
      email: brand.advisorEmail,
    },
    tags: [config.requestTag],
    callback_url: `${getAppUrl()}/api/webhooks/fdd`,
  };
}

export async function dispatchFddRequest(
  lead: LeadRecord,
  idempotencyKey: string,
): Promise<GhlDispatchResult> {
  const config = getGhlConfig();

  // Direct API enrollment is deterministic (no trigger configuration to
  // drift inside GoHighLevel), so it takes precedence when configured.
  if (config.apiToken && config.locationId) {
    return dispatchViaApi(lead, config.apiToken, config.locationId);
  }
  if (config.webhookUrl) {
    return dispatchViaWebhook(lead, idempotencyKey, config.webhookUrl);
  }

  if (devToolsEnabled()) {
    // Local dev, Vercel previews, and explicit staging: pretend GoHighLevel
    // accepted and sent the document so the flow can be exercised end to end.
    return {
      ok: true,
      mode: "simulated",
      workflowRef: `simulated_${lead.id.slice(0, 8)}`,
      confirmedSent: true,
      error: null,
    };
  }

  return {
    ok: false,
    mode: "webhook",
    workflowRef: null,
    confirmedSent: false,
    error: "GoHighLevel integration is not configured (GHL_FDD_WEBHOOK_URL or GHL_API_TOKEN/GHL_LOCATION_ID).",
  };
}

async function dispatchViaWebhook(
  lead: LeadRecord,
  idempotencyKey: string,
  webhookUrl: string,
): Promise<GhlDispatchResult> {
  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(buildFddRequestPayload(lead, idempotencyKey)),
      signal: AbortSignal.timeout(DISPATCH_TIMEOUT_MS),
    });
    if (!response.ok) {
      return {
        ok: false,
        mode: "webhook",
        workflowRef: null,
        confirmedSent: false,
        error: `GoHighLevel webhook responded ${response.status}`,
      };
    }
    return { ok: true, mode: "webhook", workflowRef: null, confirmedSent: false, error: null };
  } catch (error) {
    return {
      ok: false,
      mode: "webhook",
      workflowRef: null,
      confirmedSent: false,
      error: error instanceof Error ? error.message : "GoHighLevel webhook request failed",
    };
  }
}

async function dispatchViaApi(
  lead: LeadRecord,
  apiToken: string,
  locationId: string,
): Promise<GhlDispatchResult> {
  const config = getGhlConfig();
  try {
    const response = await fetch(`${GHL_API_BASE}/contacts/upsert`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
        Version: "2021-07-28",
      },
      body: JSON.stringify({
        locationId,
        firstName: lead.first_name,
        lastName: lead.last_name,
        email: lead.email,
        phone: lead.phone ?? undefined,
        tags: [config.requestTag],
      }),
      signal: AbortSignal.timeout(DISPATCH_TIMEOUT_MS),
    });
    if (!response.ok) {
      return {
        ok: false,
        mode: "api",
        workflowRef: null,
        confirmedSent: false,
        error: `GoHighLevel API responded ${response.status}`,
      };
    }
    const data = (await response.json().catch(() => null)) as {
      contact?: { id?: string };
    } | null;
    const contactId = data?.contact?.id ?? null;

    // Direct workflow enrollment: the FDD workflow runs for this exact
    // contact without relying on a tag-based trigger inside GoHighLevel.
    if (config.workflowId) {
      if (!contactId) {
        return {
          ok: false,
          mode: "api",
          workflowRef: null,
          confirmedSent: false,
          error: "GoHighLevel upsert did not return a contact id for workflow enrollment",
        };
      }
      const enrollment = await fetch(
        `${GHL_API_BASE}/contacts/${contactId}/workflow/${config.workflowId}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiToken}`,
            "Content-Type": "application/json",
            Version: "2021-07-28",
          },
          body: JSON.stringify({}),
          signal: AbortSignal.timeout(DISPATCH_TIMEOUT_MS),
        },
      );
      if (!enrollment.ok) {
        return {
          ok: false,
          mode: "api",
          workflowRef: contactId,
          confirmedSent: false,
          error: `GoHighLevel workflow enrollment responded ${enrollment.status}`,
        };
      }
      return {
        ok: true,
        mode: "api",
        workflowRef: `${contactId}:${config.workflowId}`,
        confirmedSent: false,
        error: null,
      };
    }

    return {
      ok: true,
      mode: "api",
      workflowRef: contactId,
      confirmedSent: false,
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      mode: "api",
      workflowRef: null,
      confirmedSent: false,
      error: error instanceof Error ? error.message : "GoHighLevel API request failed",
    };
  }
}

export { isGhlConfigured };
