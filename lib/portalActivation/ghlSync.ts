import { getGhlConfig } from "@/lib/config/fdd";
import { getPortalUrlFieldKey } from "@/lib/config/portalActivation";

/**
 * Pushes a prospect's portal link back into HighLevel as a contact custom
 * field the moment their lead is received — independent of whether they
 * ever click through Facebook's completion screen — so HighLevel workflows
 * can message it to them directly (e.g. "didn't finish signing up?").
 *
 * Reuses the same GHL_API_TOKEN already configured for the FDD workflow
 * (lib/config/fdd.ts) — no separate credential. Best-effort: a failure here
 * must never break lead intake or the activation flow.
 */

const GHL_API_BASE = "https://services.leadconnectorhq.com";
const SYNC_TIMEOUT_MS = 8000;

export interface GhlSyncResult {
  ok: boolean;
  /** True when no API token or field key is configured — not an error, just off. */
  skipped: boolean;
  error: string | null;
}

export function isPortalUrlSyncConfigured(): boolean {
  const config = getGhlConfig();
  return Boolean(config.apiToken && getPortalUrlFieldKey());
}

export async function syncPortalUrlToHighLevel(
  contactId: string,
  portalUrl: string,
): Promise<GhlSyncResult> {
  const config = getGhlConfig();
  const fieldKey = getPortalUrlFieldKey();
  if (!config.apiToken || !fieldKey) {
    return { ok: false, skipped: true, error: null };
  }

  try {
    const response = await fetch(`${GHL_API_BASE}/contacts/${contactId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${config.apiToken}`,
        "Content-Type": "application/json",
        Version: "2021-07-28",
      },
      body: JSON.stringify({
        customFields: [{ key: fieldKey, field_value: portalUrl }],
      }),
      signal: AbortSignal.timeout(SYNC_TIMEOUT_MS),
    });
    if (!response.ok) {
      // Capture HighLevel's error body (not the portal URL, not the token) —
      // this is what makes a field-key/permissions mismatch debuggable from
      // the server log without exposing anything sensitive.
      const detail = await response.text().catch(() => "");
      return {
        ok: false,
        skipped: false,
        error: `HighLevel responded ${response.status}${detail ? `: ${detail.slice(0, 300)}` : ""}`,
      };
    }
    return { ok: true, skipped: false, error: null };
  } catch (error) {
    return {
      ok: false,
      skipped: false,
      error: error instanceof Error ? error.message : "HighLevel custom field sync failed",
    };
  }
}
