import { NextResponse } from "next/server";
import { requireStaffAndLead } from "@/lib/advisor/api";
import { getGhlContactTags } from "@/lib/fdd/ghl";

export const dynamic = "force-dynamic";

/** Live HighLevel tags for this lead's contact, by email. Fetched client-side (see GhlTagsInline) so a HighLevel outage never slows the investor page itself. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const resolved = await requireStaffAndLead(request, id);
  if ("response" in resolved) return resolved.response;
  const { lead } = resolved;

  const tags = await getGhlContactTags(lead.email);
  return NextResponse.json({
    success: true,
    configured: tags !== null,
    tags: tags ?? [],
  });
}
