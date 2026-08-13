import { META_GRAPH_API_VERSION } from "@/lib/config/tracking";
import { hashEmail, hashExternalId, hashLower, hashName, hashPhone } from "@/lib/tracking/metaHash";

/**
 * Meta Conversions API dispatch. Endpoint/payload shape per Meta's current
 * developer docs (graph.facebook.com/{version}/{pixel-id}/events) — verify
 * against https://developers.facebook.com/docs/marketing-api/conversions-api
 * before relying on this in production; Meta revises supported fields and
 * standard event names periodically (spec §3-C, §7).
 */

export interface MetaCapiCustomerData {
  email?: string | null;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
  externalId?: string | null;
  /** Meta browser ID cookie (_fbp) — unhashed per Meta spec. */
  fbp?: string | null;
  /** Meta click ID cookie (_fbc) — unhashed per Meta spec. */
  fbc?: string | null;
  clientIpAddress?: string | null;
  clientUserAgent?: string | null;
}

export interface MetaCapiEventInput {
  eventName: string;
  eventId: string;
  eventTimeSeconds: number;
  eventSourceUrl?: string | null;
  actionSource?: "website";
  customerData: MetaCapiCustomerData;
  /** Only non-sensitive, coarse conversion-state fields — never financial/questionnaire data (spec §10). */
  customData?: Record<string, unknown> | null;
  testEventCode?: string | null;
}

export interface MetaCapiResult {
  ok: boolean;
  status: number;
  /** Sanitized — safe to store/log. Never contains the access token. */
  body: unknown;
}

function buildUserData(data: MetaCapiCustomerData): Record<string, string[]> {
  const userData: Record<string, string[]> = {};
  const add = (key: string, hashed: string | null) => {
    if (hashed) userData[key] = [hashed];
  };
  add("em", hashEmail(data.email));
  add("ph", hashPhone(data.phone));
  add("fn", hashName(data.firstName));
  add("ln", hashName(data.lastName));
  add("ct", hashLower(data.city));
  add("st", hashLower(data.state));
  add("zp", hashLower(data.postalCode));
  add("country", hashLower(data.country));
  add("external_id", hashExternalId(data.externalId));
  // fbp/fbc are sent unhashed per Meta's spec — they aren't PII, just cookie IDs.
  if (data.fbp) userData.fbp = [data.fbp];
  if (data.fbc) userData.fbc = [data.fbc];
  if (data.clientIpAddress) userData.client_ip_address = [data.clientIpAddress];
  if (data.clientUserAgent) userData.client_user_agent = [data.clientUserAgent];
  return userData;
}

export async function sendMetaCapiEvent(
  pixelId: string,
  accessToken: string,
  input: MetaCapiEventInput,
): Promise<MetaCapiResult> {
  const payload = {
    data: [
      {
        event_name: input.eventName,
        event_time: input.eventTimeSeconds,
        event_id: input.eventId,
        event_source_url: input.eventSourceUrl ?? undefined,
        action_source: input.actionSource ?? "website",
        user_data: buildUserData(input.customerData),
        ...(input.customData && Object.keys(input.customData).length > 0
          ? { custom_data: input.customData }
          : {}),
      },
    ],
    ...(input.testEventCode ? { test_event_code: input.testEventCode } : {}),
  };

  try {
    const response = await fetch(
      `https://graph.facebook.com/${META_GRAPH_API_VERSION}/${encodeURIComponent(pixelId)}/events`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, access_token: accessToken }),
        signal: AbortSignal.timeout(5000),
      },
    );
    const body = await response.json().catch(() => null);
    return { ok: response.ok, status: response.status, body };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      body: { error: error instanceof Error ? error.message : "network error" },
    };
  }
}
