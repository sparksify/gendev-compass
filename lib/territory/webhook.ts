import { createHmac } from "crypto";
import { devToolsEnabled } from "@/lib/config/env";
import type { LeadRecord } from "@/types/lead";
import type { TerritoryReviewRequestRecord } from "@/types/territory";

/**
 * Outbound `territory.review_requested` webhook, mirroring the dispatch
 * shape in lib/fdd/ghl.ts: a single POST with a short timeout, never throws,
 * simulated when unconfigured outside production so the flow stays fully
 * demoable, and the UI never fails just because this call does.
 */

export interface TerritoryWebhookResult {
  ok: boolean;
  mode: "webhook" | "simulated" | "not_configured";
  error: string | null;
}

const DISPATCH_TIMEOUT_MS = 8000;

export function getTerritoryWebhookUrl(): string | null {
  return process.env.TERRITORY_REVIEW_WEBHOOK_URL ?? null;
}

function getTerritoryWebhookSecret(): string | null {
  return process.env.TERRITORY_REVIEW_WEBHOOK_SECRET ?? null;
}

export function buildTerritoryReviewPayload(
  lead: LeadRecord,
  brandId: string,
  reviewRequest: TerritoryReviewRequestRecord,
  searchedLocation: string | null,
  resultStatus: string | null,
): Record<string, unknown> {
  return {
    event: "territory.review_requested",
    userId: lead.id,
    brandId,
    territorySearchId: reviewRequest.territory_search_id,
    reviewRequestId: reviewRequest.id,
    name: `${lead.first_name} ${lead.last_name}`.trim(),
    email: lead.email,
    phone: lead.phone,
    searchedLocation,
    resultStatus,
    createdAt: reviewRequest.created_at,
  };
}

/** HMAC-SHA256 over the raw JSON body — a receiver can verify with the shared secret. */
function signPayload(rawBody: string, secret: string): string {
  return `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
}

export async function dispatchTerritoryReviewWebhook(
  lead: LeadRecord,
  brandId: string,
  reviewRequest: TerritoryReviewRequestRecord,
  searchedLocation: string | null,
  resultStatus: string | null,
): Promise<TerritoryWebhookResult> {
  const url = getTerritoryWebhookUrl();
  const secret = getTerritoryWebhookSecret();

  if (!url) {
    if (devToolsEnabled()) {
      return { ok: true, mode: "simulated", error: null };
    }
    return {
      ok: false,
      mode: "not_configured",
      error: "TERRITORY_REVIEW_WEBHOOK_URL is not configured.",
    };
  }

  const payload = buildTerritoryReviewPayload(lead, brandId, reviewRequest, searchedLocation, resultStatus);
  const rawBody = JSON.stringify(payload);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (secret) headers["x-territory-signature"] = signPayload(rawBody, secret);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: rawBody,
      signal: AbortSignal.timeout(DISPATCH_TIMEOUT_MS),
    });
    if (!response.ok) {
      return { ok: false, mode: "webhook", error: `Territory review webhook responded ${response.status}` };
    }
    return { ok: true, mode: "webhook", error: null };
  } catch (error) {
    return {
      ok: false,
      mode: "webhook",
      error: error instanceof Error ? error.message : "Territory review webhook request failed",
    };
  }
}
