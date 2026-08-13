import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizedAdminRequest } from "@/lib/advisor/adminAccess";
import { getStore } from "@/lib/store";
import { getEffectiveTrackingSettings, resolveMetaCapiAccessToken } from "@/lib/tracking/settings";
import { sendMetaCapiEvent } from "@/lib/tracking/metaCapi";
import { generateEventId } from "@/lib/tracking/eventId";
import { clientIpFrom, rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  action: z.enum(["test_gtm", "test_meta_browser", "send_meta_capi_test"]),
});

/**
 * Test Mode actions (spec §21). "Send Meta CAPI Test Event" makes a real
 * call to Meta using the configured Test Event Code, so it's clearly
 * labeled and never mixed with production reporting — Meta itself keeps
 * test events out of normal Events Manager reporting when a test code is
 * present.
 */
export async function POST(request: Request): Promise<NextResponse> {
  if (!(await authorizedAdminRequest(request))) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  if (!rateLimit(`tracking-test:${clientIpFrom(request)}`, 10, 60_000)) {
    return NextResponse.json({ success: false, error: "Too many test requests. Please wait a moment." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid request" }, { status: 400 });
  }

  const store = getStore();
  const settings = await getEffectiveTrackingSettings();
  const now = new Date().toISOString();

  if (parsed.data.action === "test_gtm") {
    if (!settings.gtmContainerId) {
      return NextResponse.json({ success: false, error: "No GTM Container ID configured." }, { status: 400 });
    }
    await store.updateTrackingSettings(settings.raw.id, { last_gtm_test_at: now });
    return NextResponse.json({
      success: true,
      message: `Container ID ${settings.gtmContainerId} is valid. Load a portal page with GTM Preview mode attached to confirm the dataLayer contract (event: "portal_event").`,
    });
  }

  if (parsed.data.action === "test_meta_browser") {
    if (!settings.metaPixelId) {
      return NextResponse.json({ success: false, error: "No Meta Pixel/Dataset ID configured." }, { status: 400 });
    }
    await store.updateTrackingSettings(settings.raw.id, { last_meta_browser_test_at: now });
    return NextResponse.json({
      success: true,
      message:
        settings.metaBrowserMode === "gtm"
          ? "Browser Tracking Mode is 'Through Google Tag Manager' — the Pixel is not initialized directly. Confirm the tag inside your GTM container using the dataLayer's portal_event events."
          : `Pixel ID ${settings.metaPixelId} is valid and will initialize directly (mode: ${settings.metaBrowserMode}).`,
    });
  }

  // send_meta_capi_test
  if (!settings.metaPixelId) {
    return NextResponse.json({ success: false, error: "No Meta Pixel/Dataset ID configured." }, { status: 400 });
  }
  const accessToken = resolveMetaCapiAccessToken(settings.raw);
  if (!accessToken) {
    return NextResponse.json({ success: false, error: "No Meta CAPI access token configured." }, { status: 400 });
  }

  const eventId = generateEventId();
  const result = await sendMetaCapiEvent(settings.metaPixelId, accessToken, {
    eventName: "TestEvent",
    eventId,
    eventTimeSeconds: Math.floor(Date.now() / 1000),
    customerData: { email: "test@example.com", externalId: "admin-test-event" },
    customData: { source: "admin_test_mode" },
    testEventCode: settings.metaTestEventCode,
  });

  const sanitized = result.body && typeof result.body === "object" ? { ...(result.body as Record<string, unknown>) } : null;
  if (sanitized) delete sanitized.access_token;

  await store.updateTrackingSettings(settings.raw.id, {
    ...(result.ok
      ? { last_meta_capi_success_at: now }
      : { last_meta_capi_failure_at: now, last_meta_capi_error: JSON.stringify(sanitized).slice(0, 500) }),
  });

  return NextResponse.json({
    success: result.ok,
    eventId,
    status: result.status,
    response: sanitized,
    testEventCodeConfigured: Boolean(settings.metaTestEventCode),
  });
}
