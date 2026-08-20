import { createHmac } from "crypto";
import { devToolsEnabled } from "@/lib/config/env";
import { listMappingsForEntity } from "@/lib/domain/mappings";
import { resolveBridgeEvent } from "@/lib/os-bridge/rules";
import type { LeadRecord } from "@/types/lead";

/**
 * Outbound bridge to the AI Employee OS: curated portal behavior events,
 * HMAC-signed, fire-and-forget. Mirrors lib/territory/webhook.ts — a single
 * POST with a short timeout, never throws, simulated when unconfigured
 * outside production. The portal experience never fails because of this call;
 * the OS treats delivery as advisory (its employees re-read fresh state at
 * every wake regardless).
 */

export interface OsBridgeResult {
  ok: boolean;
  mode: "webhook" | "simulated" | "not_configured" | "not_forwarded";
  error: string | null;
}

const DISPATCH_TIMEOUT_MS = 8000;

export function getOsBridgeWebhookUrl(): string | null {
  return process.env.OS_BRIDGE_WEBHOOK_URL ?? null;
}

function getOsBridgeWebhookSecret(): string | null {
  return process.env.OS_BRIDGE_WEBHOOK_SECRET ?? null;
}

function getOsBridgeBrand(): string {
  return process.env.OS_BRIDGE_BRAND ?? "cmdt";
}

function signPayload(rawBody: string, secret: string): string {
  return `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
}

/** The lead's GoHighLevel contact id, when intake registered one. */
async function findGhlContactId(lead: LeadRecord): Promise<string | null> {
  if (!lead.client_id) return null;
  try {
    const mappings = await listMappingsForEntity(lead.client_id);
    return (
      mappings.find((m) => m.provider === "gohighlevel" && m.entity_type === "client")
        ?.external_id ?? null
    );
  } catch {
    return null;
  }
}

export async function buildOsBridgeEnvelope(
  lead: LeadRecord,
  bridgeEvent: string,
  eventData: Record<string, unknown> | null,
  opts: { eventId: string; occurredAt: string; source: string },
): Promise<Record<string, unknown>> {
  return {
    eventId: opts.eventId,
    event: bridgeEvent,
    occurredAt: opts.occurredAt,
    source: opts.source,
    lead: {
      id: lead.id,
      email: lead.email,
      phone: lead.phone,
      ghlContactId: await findGhlContactId(lead),
      brand: getOsBridgeBrand(),
    },
    data: eventData ?? undefined,
  };
}

export async function dispatchOsBridgeEvent(
  lead: LeadRecord,
  eventName: string,
  eventData: Record<string, unknown> | null,
  opts: { eventId: string; occurredAt?: string | null; source?: string },
): Promise<OsBridgeResult> {
  const bridgeEvent = resolveBridgeEvent(eventName);
  if (!bridgeEvent) return { ok: true, mode: "not_forwarded", error: null };

  const url = getOsBridgeWebhookUrl();
  const secret = getOsBridgeWebhookSecret();
  if (!url || !secret) {
    if (devToolsEnabled()) return { ok: true, mode: "simulated", error: null };
    return {
      ok: false,
      mode: "not_configured",
      error: "OS_BRIDGE_WEBHOOK_URL / OS_BRIDGE_WEBHOOK_SECRET are not configured.",
    };
  }

  const envelope = await buildOsBridgeEnvelope(lead, bridgeEvent, eventData, {
    eventId: opts.eventId,
    occurredAt: opts.occurredAt ?? new Date().toISOString(),
    source: opts.source ?? "portal",
  });
  const rawBody = JSON.stringify(envelope);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-compass-signature": signPayload(rawBody, secret),
      },
      body: rawBody,
      signal: AbortSignal.timeout(DISPATCH_TIMEOUT_MS),
    });
    if (!response.ok) {
      return { ok: false, mode: "webhook", error: `OS bridge webhook responded ${response.status}` };
    }
    return { ok: true, mode: "webhook", error: null };
  } catch (error) {
    return {
      ok: false,
      mode: "webhook",
      error: error instanceof Error ? error.message : "OS bridge webhook request failed",
    };
  }
}
