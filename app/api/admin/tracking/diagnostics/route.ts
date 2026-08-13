import { NextResponse } from "next/server";
import { authorizedAdminRequest } from "@/lib/advisor/adminAccess";
import { getStore } from "@/lib/store";
import { getEffectiveTrackingSettings } from "@/lib/tracking/settings";

export const dynamic = "force-dynamic";

/**
 * Diagnostics tab data (spec §14): provider status, recent events, today's
 * counts, and the delivery log. Access tokens are never included — the
 * delivery log only ever stores sanitized provider responses
 * (lib/tracking/dispatch.ts).
 */
export async function GET(request: Request): Promise<NextResponse> {
  if (!(await authorizedAdminRequest(request))) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const store = getStore();
  const settings = await getEffectiveTrackingSettings();
  const deliveries = await store.listTrackingDeliveries({ limit: 500 });
  const leads = await store.listLeads();
  const leadById = new Map(leads.map((l) => [l.id, l]));

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const todayIso = startOfToday.toISOString();

  const today = deliveries.filter((d) => d.created_at >= todayIso);
  const serverFailedToday = today.filter((d) => d.provider === "meta_capi" && d.status === "failed").length;
  const browserFailedToday = today.filter((d) => d.provider !== "meta_capi" && d.status === "failed").length;

  // "Deduplicated" — event IDs that reached both a browser provider and
  // meta_capi successfully, i.e. Meta can dedup them client/server-side.
  const eventIdProviders = new Map<string, Set<string>>();
  for (const d of deliveries) {
    if (d.status !== "sent" && d.status !== "test") continue;
    if (!eventIdProviders.has(d.event_id)) eventIdProviders.set(d.event_id, new Set());
    eventIdProviders.get(d.event_id)!.add(d.provider);
  }
  const deduplicatedEvents = Array.from(eventIdProviders.values()).filter(
    (providers) => providers.has("meta_capi") && (providers.has("meta_browser") || providers.has("gtm")),
  ).length;

  const lastByProvider = (provider: "gtm" | "meta_browser" | "meta_capi") =>
    deliveries.find((d) => d.provider === provider) ?? null;

  const log = deliveries.slice(0, 100).map((d) => {
    const lead = d.lead_id ? leadById.get(d.lead_id) : null;
    return {
      id: d.id,
      timestamp: d.created_at,
      prospect: lead ? `${lead.first_name} ${lead.last_name}` : "—",
      portalEvent: d.event_name,
      eventId: d.event_id,
      provider: d.provider,
      status: d.status,
      responseCode: d.response_code,
    };
  });

  return NextResponse.json({
    success: true,
    status: {
      gtm: settings.gtmEnabled ? "connected" : "not_configured",
      metaBrowser: settings.metaEnabled ? "connected" : "not_configured",
      metaCapi: settings.metaCapiEnabled ? "connected" : "not_configured",
    },
    lastEvents: {
      portalEvent: deliveries[0]?.created_at ?? null,
      metaBrowserEvent: lastByProvider("meta_browser")?.created_at ?? null,
      metaServerEvent: lastByProvider("meta_capi")?.created_at ?? null,
    },
    counts: {
      eventsToday: today.length,
      serverEventsFailedToday: serverFailedToday,
      browserEventsFailedToday: browserFailedToday,
      deduplicatedEvents,
    },
    log,
  });
}
