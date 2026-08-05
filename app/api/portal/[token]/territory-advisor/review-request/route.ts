import { NextResponse } from "next/server";
import { requireLead } from "@/lib/portal/api";
import { getStore } from "@/lib/store";
import { trackEvent } from "@/lib/portal/events";
import { rateLimit } from "@/lib/rateLimit";
import { territoryReviewRequestSchema } from "@/lib/validation/territory";
import { getCurrentBrand, fallbackBrandName } from "@/lib/territory/brand";
import { dispatchTerritoryReviewWebhook } from "@/lib/territory/webhook";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  const { token } = await params;
  const resolved = await requireLead(token);
  if ("response" in resolved) return resolved.response;
  const { lead } = resolved;

  if (!rateLimit(`territory-review:${lead.id}`, 10, 60_000)) {
    return NextResponse.json({ success: false, error: "Too many requests. Please slow down." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = territoryReviewRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid request", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const brand = await getCurrentBrand();
  if (!brand) {
    return NextResponse.json(
      { success: false, error: `Territory review isn't available for ${fallbackBrandName()} yet.` },
      { status: 503 },
    );
  }

  try {
    const store = getStore();

    // If the referenced search doesn't belong to this lead, ignore the
    // reference rather than trusting a client-supplied foreign id.
    let territorySearchId: string | null = null;
    let searchedLocation: string | null = null;
    let resultStatus: string | null = null;
    if (parsed.data.territorySearchId) {
      const search = await store.getTerritorySearch(parsed.data.territorySearchId);
      if (search && search.lead_id === lead.id) {
        territorySearchId = search.id;
        searchedLocation = search.normalized_location ?? search.raw_query;
        resultStatus = search.result_status;
      }
    }

    const reviewRequest = await store.createTerritoryReviewRequest({
      lead_id: lead.id,
      brand_id: brand.id,
      territory_search_id: territorySearchId,
      prospect_message: parsed.data.message ?? null,
      // Platform links from the lead's chain (set by the portal loader).
      organization_id: lead.organization_id,
      client_id: lead.client_id,
      opportunity_id: lead.primary_opportunity_id,
    });

    await trackEvent(lead, "territory_review_requested", {
      reviewRequestId: reviewRequest.id,
      territorySearchId,
    });

    // The webhook is a nice-to-have integration hook — its failure must
    // never fail the prospect-facing request.
    const webhookResult = await dispatchTerritoryReviewWebhook(
      lead,
      brand.id,
      reviewRequest,
      searchedLocation,
      resultStatus,
    );
    if (!webhookResult.ok) {
      console.error("[territory-advisor/review-request] webhook dispatch failed:", webhookResult.error);
    }

    return NextResponse.json({ success: true, reviewRequestId: reviewRequest.id });
  } catch (error) {
    console.error("[territory-advisor/review-request] failed:", error);
    return NextResponse.json(
      { success: false, error: "We couldn't submit your request. Please try again." },
      { status: 500 },
    );
  }
}
