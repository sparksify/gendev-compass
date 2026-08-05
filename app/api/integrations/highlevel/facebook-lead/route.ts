import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { isValidBrandSlug } from "@/lib/config/brands";
import { getHighLevelWebhookSecret } from "@/lib/config/portalActivation";
import { normalizeEmail, normalizePhone, phoneLastFour } from "@/lib/portalActivation/normalize";
import { logActivation } from "@/lib/portalActivation/log";
import { absolutePortalUrlFor, provisionPortalLead } from "@/lib/portalActivation/service";
import { isPortalUrlSyncConfigured, syncPortalUrlToHighLevel } from "@/lib/portalActivation/ghlSync";
import { highLevelFacebookLeadSchema } from "@/lib/validation/portalActivation";
import { clientIpFrom, rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

/**
 * Receives a Facebook lead from HighLevel immediately after submission (see
 * HIGHLEVEL_SETUP.md). Idempotent on (contactId, locationId) — HighLevel
 * retries are safe to replay. The record lands "unclaimed"; the activation
 * flow (/api/portal-activation/*) is what claims it.
 */
export async function POST(request: Request): Promise<NextResponse> {
  if (!rateLimit(`hl-lead:${clientIpFrom(request)}`, 60, 60_000)) {
    return NextResponse.json({ success: false, error: "Too many requests" }, { status: 429 });
  }

  if (!isAuthorized(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = highLevelFacebookLeadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid payload", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const input = parsed.data;

  if (!isValidBrandSlug(input.brandSlug)) {
    // A safe, generic rejection — never confirms/denies details about the lead itself.
    return NextResponse.json({ success: false, error: "Unknown brand" }, { status: 400 });
  }

  try {
    const normalizedPhone = normalizePhone(input.phone);
    const { record, duplicate } = await getStore().upsertExternalLead({
      highlevel_contact_id: input.contactId,
      highlevel_location_id: input.locationId,
      brand_slug: input.brandSlug,
      advisor_id: input.advisorId ?? null,
      first_name: input.firstName ?? null,
      last_name: input.lastName ?? null,
      normalized_email: normalizeEmail(input.email),
      normalized_phone: normalizedPhone,
      phone_last_four: phoneLastFour(input.phone),
      source: input.source ?? "facebook_lead_ad",
      facebook_page_id: input.facebookPageId ?? null,
      facebook_form_id: input.facebookFormId ?? null,
      facebook_campaign_id: input.facebookCampaignId ?? null,
      facebook_ad_id: input.facebookAdId ?? null,
      submitted_at: input.submittedAt ?? null,
      received_at: new Date().toISOString(),
    });

    // Structured, PII-free log — no name/email/phone/contact id.
    logActivation("lead_received", {
      externalLeadId: record.id,
      brand: record.brand_slug,
      source: record.source,
      hasForm: Boolean(record.facebook_form_id),
      duplicate,
    });

    // Provision the portal link immediately — independent of whether the
    // prospect ever clicks Facebook's completion button — and push it into
    // HighLevel as a contact custom field so HighLevel workflows can send it
    // directly (e.g. to anyone who doesn't click through). The activation
    // flow's claim path (lib/portalActivation/service.ts) looks up the same
    // lead by brand + HighLevel contact id, so it's never duplicated.
    let portalLinkSynced = false;
    let portalLinkSyncError: string | null = null;
    try {
      const lead = await provisionPortalLead(record, record.brand_slug);
      if (isPortalUrlSyncConfigured()) {
        const result = await syncPortalUrlToHighLevel(
          input.contactId,
          absolutePortalUrlFor(record.brand_slug, lead),
        );
        portalLinkSynced = result.ok;
        portalLinkSyncError = result.error;
        logActivation("portal_link_sync", {
          externalLeadId: record.id,
          leadId: lead.id,
          ok: result.ok,
          skipped: result.skipped,
        });
      }
    } catch (error) {
      // Never let provisioning/sync failure break lead intake — HighLevel
      // must still get a 200 so it doesn't treat this as a failed delivery.
      portalLinkSyncError = error instanceof Error ? error.message : "Portal link provisioning failed";
      console.error("[highlevel-facebook-lead] portal link provisioning failed:", error);
    }

    return NextResponse.json({
      success: true,
      duplicate,
      portalLinkSynced,
      ...(portalLinkSyncError ? { portalLinkSyncError } : {}),
    });
  } catch (error) {
    console.error("[highlevel-facebook-lead] intake failed:", error);
    return NextResponse.json({ success: false, error: "Lead intake failed" }, { status: 500 });
  }
}

function isAuthorized(request: Request): boolean {
  const secret = getHighLevelWebhookSecret();
  if (!secret) return false; // required in every environment — no open-door dev fallback for a public webhook
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return false;
  return timingSafeEquals(header.slice("Bearer ".length), secret);
}

function timingSafeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
