import { NextResponse } from "next/server";
import { requireStaffAndLead } from "@/lib/advisor/api";
import { fetchGhlContactTags, ghlContactUrl } from "@/lib/ghl/contactTags";

export const dynamic = "force-dynamic";

/**
 * Resolves a lead's HighLevel contact URL on demand — deliberately not
 * precomputed for every row on the Clients board, since that would mean one
 * live HighLevel lookup per visible card on every page load. Fetched only
 * when someone actually clicks "Open in HighLevel" on a card.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const resolved = await requireStaffAndLead(request, id);
  if ("response" in resolved) return resolved.response;
  const { lead } = resolved;

  const tags = await fetchGhlContactTags(lead);
  const url = tags.status === "ok" ? ghlContactUrl(tags.contactId) : null;
  const reason =
    tags.status === "not_configured"
      ? "HighLevel isn't connected."
      : tags.status === "unavailable"
        ? tags.reason
        : url
          ? null
          : "This contact hasn't been synced to HighLevel yet.";

  return NextResponse.json({ success: true, url, reason });
}
