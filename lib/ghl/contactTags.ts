import { getGhlConfig } from "@/lib/config/fdd";
import type { LeadRecord } from "@/types/lead";

/**
 * Read a contact's tags back out of GoHighLevel.
 *
 * The rest of the GHL integration only ever pushes (lib/fdd/ghl.ts upserts a
 * contact with the FDD request tag). The client detail page wants the other
 * direction: the tags a lead has accumulated in HighLevel — campaign source,
 * lifecycle, segment — which are maintained there, not here.
 *
 * Nothing is stored locally. The lookup is server-side only (the API token
 * must never reach the browser), it is bounded by a short timeout, and every
 * failure mode degrades to a state the card can render honestly rather than
 * throwing — a page must not 500 because an external CRM is slow.
 */

const GHL_API_BASE = "https://services.leadconnectorhq.com";
const LOOKUP_TIMEOUT_MS = 4000;

export type GhlTagsState =
  /** No API token configured — the integration isn't connected here. */
  | { status: "not_configured" }
  /** Reached GoHighLevel; `tags` may legitimately be empty. */
  | { status: "ok"; tags: string[]; contactId: string | null; fetchedAt: string }
  /** Configured but the lookup failed, or the contact isn't in GoHighLevel. */
  | { status: "unavailable"; reason: string };

/**
 * Look up the lead's GoHighLevel contact by email and return its tags.
 *
 * Email is the join key because it is what `contacts/upsert` matches on, so a
 * contact this app has ever pushed is findable by the same key.
 */
export async function fetchGhlContactTags(lead: LeadRecord): Promise<GhlTagsState> {
  const config = getGhlConfig();
  if (!config.apiToken || !config.locationId) return { status: "not_configured" };
  if (!lead.email) return { status: "unavailable", reason: "This lead has no email to match on." };

  const url = new URL(`${GHL_API_BASE}/contacts/`);
  url.searchParams.set("locationId", config.locationId);
  url.searchParams.set("query", lead.email);
  url.searchParams.set("limit", "1");

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${config.apiToken}`,
        Version: "2021-07-28",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        status: "unavailable",
        reason: `GoHighLevel responded ${response.status}.`,
      };
    }

    const data = (await response.json().catch(() => null)) as {
      contacts?: Array<{ id?: string; email?: string; tags?: unknown }>;
    } | null;

    // The search endpoint is fuzzy, so only accept an exact email match —
    // showing another person's tags on this page would be worse than none.
    const contact = data?.contacts?.find(
      (candidate) => candidate.email?.toLowerCase() === lead.email.toLowerCase(),
    );
    if (!contact) {
      return { status: "unavailable", reason: "No matching HighLevel contact." };
    }

    const tags = Array.isArray(contact.tags)
      ? contact.tags.filter((tag): tag is string => typeof tag === "string" && tag.trim() !== "")
      : [];

    return {
      status: "ok",
      tags: [...new Set(tags.map((tag) => tag.trim()))].sort((a, b) => a.localeCompare(b)),
      contactId: contact.id ?? null,
      fetchedAt: new Date().toISOString(),
    };
  } catch (error) {
    // A timeout or a network fault is not a page error — the card says so.
    return {
      status: "unavailable",
      reason:
        error instanceof Error && error.name === "TimeoutError"
          ? "HighLevel did not respond in time."
          : "Could not reach HighLevel.",
    };
  }
}

/** Deep link to the contact in HighLevel, when we know both ids. */
export function ghlContactUrl(contactId: string | null): string | null {
  const { locationId } = getGhlConfig();
  if (!contactId || !locationId) return null;
  return `https://app.gohighlevel.com/v2/location/${locationId}/contacts/detail/${contactId}`;
}
