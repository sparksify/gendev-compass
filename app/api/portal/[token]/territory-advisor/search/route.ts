import { NextResponse } from "next/server";
import { requireLead } from "@/lib/portal/api";
import { getStore } from "@/lib/store";
import { trackEvent } from "@/lib/portal/events";
import { rateLimit } from "@/lib/rateLimit";
import { territorySearchSchema } from "@/lib/validation/territory";
import { evaluateTerritory, unconfiguredBrandResult } from "@/lib/territory/evaluate";
import { resolveFollowUp } from "@/lib/territory/intent";
import { getCurrentBrand, fallbackBrandName } from "@/lib/territory/brand";
import { getDefaultRadiusMiles } from "@/lib/config/territory";
import type { PortalEventName } from "@/types/analytics";
import type { TerritoryEvaluationResult } from "@/types/territory";

export const dynamic = "force-dynamic";

const RESULT_EVENT: Partial<Record<TerritoryEvaluationResult["status"], PortalEventName>> = {
  AVAILABLE: "territory_result_available",
  PARTIALLY_AVAILABLE: "territory_result_partial",
  UNAVAILABLE: "territory_result_unavailable",
  STATE_RESTRICTED: "territory_result_state_restricted",
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  const { token } = await params;
  const resolved = await requireLead(token);
  if ("response" in resolved) return resolved.response;
  const { lead } = resolved;

  if (!rateLimit(`territory-search:${lead.id}`, 20, 60_000)) {
    return NextResponse.json({ success: false, error: "Too many requests. Please slow down." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = territorySearchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid request", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const brand = await getCurrentBrand();
  if (!brand) {
    const result = unconfiguredBrandResult(parsed.data.query ?? "current location", fallbackBrandName());
    await trackEvent(lead, "territory_search_submitted", { query: result.location.query });
    return NextResponse.json({ success: true, result });
  }

  try {
    const store = getStore();
    const priorSearches = await store.listTerritorySearchesForLead(lead.id);
    const lastForBrand = priorSearches.find((s) => s.brand_id === brand.id);
    const lastResult = (lastForBrand?.result_summary as TerritoryEvaluationResult | null | undefined) ?? null;

    await trackEvent(lead, "territory_search_submitted", {
      query: parsed.data.query ?? "current location",
    });

    const usingCoordinates = parsed.data.latitude != null && parsed.data.longitude != null;
    const resolution = usingCoordinates
      ? { query: parsed.data.query ?? "Current location", radiusMiles: parsed.data.radiusMiles ?? brand.default_radius_miles ?? getDefaultRadiusMiles() }
      : await resolveFollowUp(parsed.data.query ?? "", lastResult);

    if ("showAlternatives" in resolution) {
      const alternatives = lastResult?.alternatives ?? [];
      return NextResponse.json({
        success: true,
        kind: "alternatives",
        alternatives,
        message:
          alternatives.length > 0
            ? "Here are nearby markets that may still be worth exploring:"
            : "Search a market first and I can suggest nearby alternatives if this one isn't open.",
      });
    }

    const radiusMiles = parsed.data.radiusMiles ?? resolution.radiusMiles ?? brand.default_radius_miles ?? getDefaultRadiusMiles();

    const result = await evaluateTerritory({
      brandId: brand.id,
      query: resolution.query,
      radiusMiles,
      leadId: lead.id,
      coordinates: usingCoordinates
        ? { latitude: parsed.data.latitude!, longitude: parsed.data.longitude! }
        : undefined,
      // Platform links from the lead's chain (set by the portal loader);
      // territory activity is opportunity-specific.
      links: {
        organization_id: lead.organization_id,
        client_id: lead.client_id,
        opportunity_id: lead.primary_opportunity_id,
      },
    });

    await trackEvent(lead, "territory_search_completed", {
      status: result.status,
      radiusMiles,
    });
    const resultEvent = RESULT_EVENT[result.status];
    if (resultEvent) await trackEvent(lead, resultEvent, { location: result.location.displayName });
    if (parsed.data.origin === "alternative") {
      await trackEvent(lead, "territory_alternative_selected", { location: result.location.displayName });
    }

    return NextResponse.json({ success: true, kind: "result", result, resolvedQuery: resolution.query });
  } catch (error) {
    console.error("[territory-advisor/search] failed:", error);
    await trackEvent(lead, "territory_search_failed", null);
    return NextResponse.json(
      { success: false, error: "We couldn't complete that check. Please try again." },
      { status: 500 },
    );
  }
}
