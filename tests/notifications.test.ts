/**
 * Advisor notification layer, exercised end to end against the file-backed
 * dev store (same PortalStore interface as Supabase) with only the outbound
 * HTTP call stubbed. Entry point is recordLeadEvent — the same function every
 * route handler calls — so these cover the real wiring rather than the
 * dispatcher in isolation.
 */
import { mkdtempSync, rmSync } from "fs";
import os from "os";
import path from "path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PortalStore } from "@/lib/store/types";
import type { LeadRecord } from "@/types/lead";

const tmpDir = mkdtempSync(path.join(os.tmpdir(), "notifications-test-"));
const originalCwd = process.cwd();

let store: PortalStore;
let recordLeadEvent: typeof import("@/lib/domain/activities").recordLeadEvent;
let resolveNotificationRule: typeof import("@/lib/notifications/rules").resolveNotificationRule;
let buildDedupeKey: typeof import("@/lib/notifications/rules").buildDedupeKey;

/** Resend accepted the message. */
function okResponse(id = "resend-msg-1") {
  return new Response(JSON.stringify({ id }), { status: 200 });
}

/** Resend rejected the message (e.g. unverified sender domain). */
function errorResponse(message = "Domain is not verified") {
  return new Response(JSON.stringify({ message }), { status: 422 });
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeAll(async () => {
  process.chdir(tmpDir);
  process.env.RESEND_API_KEY = "re_test_key";
  process.env.NOTIFICATION_FROM_EMAIL = "Compass <compass@example.test>";
  process.env.DEFAULT_ADVISOR_NOTIFICATION_EMAIL = "default-advisor@example.test";
  process.env.NEXT_PUBLIC_APP_URL = "https://compass.example.test";

  const storeModule = await import("@/lib/store");
  store = storeModule.getStore();
  ({ recordLeadEvent } = await import("@/lib/domain/activities"));
  ({ resolveNotificationRule, buildDedupeKey } = await import("@/lib/notifications/rules"));
});

afterAll(() => {
  process.chdir(originalCwd);
  rmSync(tmpDir, { recursive: true, force: true });
});

beforeEach(() => {
  fetchMock = vi.fn(async () => okResponse());
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NOTIFY_ON_VIDEO_COMPLETED;
});

let seq = 0;

async function makeStoredLead(overrides: Partial<LeadRecord> = {}): Promise<LeadRecord> {
  seq += 1;
  const lead = await store.createLead({
    portal_token: `notif-token-${seq}-0123456789abcdef`,
    first_name: "Dana",
    last_name: `Investor${seq}`,
    email: `dana${seq}@example.test`,
    phone: "+15551230000",
    state: "Texas",
    source: "test",
    campaign: null,
    ad_set: null,
    ad: null,
    facebook_lead_id: null,
    initial_liquid_capital: null,
    initial_net_worth: null,
    initial_business_owner: null,
  });
  if (Object.keys(overrides).length === 0) return lead;
  return store.updateLead(lead.id, overrides);
}

/** The email payload handed to Resend, parsed. */
function sentPayload(call = 0): Record<string, unknown> {
  const body = fetchMock.mock.calls[call]?.[1] as { body: string };
  return JSON.parse(body.body) as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Notification rules — policy lives in exactly one module.
// ---------------------------------------------------------------------------

describe("notification rules", () => {
  it("emails immediately on questionnaire completion", () => {
    const rule = resolveNotificationRule("questionnaire_submitted");
    expect(rule?.action).toBe("immediate_email");
    expect(rule?.templateKey).toBe("questionnaire_completed");
  });

  it("emails immediately on consultation scheduled and strategist review requested", () => {
    expect(resolveNotificationRule("calendar_booking_completed")?.action).toBe("immediate_email");
    expect(resolveNotificationRule("consultation_booked")?.action).toBe("immediate_email");
    expect(resolveNotificationRule("territory_review_requested")?.action).toBe("immediate_email");
  });

  it("stays silent for engagement events that only belong on the dashboard", () => {
    for (const event of [
      "portal_opened",
      "video_started",
      "video_progress_25",
      "video_progress_50",
      "video_progress_75",
      "client_questionnaire_started",
      "territory_search_submitted",
    ]) {
      expect(resolveNotificationRule(event), event).toBeNull();
    }
  });

  it("defaults an unrecognized event to dashboard-only", () => {
    expect(resolveNotificationRule("some_future_event")).toBeNull();
  });

  it("records video completion without emailing until it is switched on", () => {
    expect(resolveNotificationRule("video_completion_threshold_reached")).toBeNull();

    process.env.NOTIFY_ON_VIDEO_COMPLETED = "true";
    expect(resolveNotificationRule("video_completion_threshold_reached")?.action).toBe(
      "immediate_email",
    );
  });

  it("collapses the two consultation paths onto one dedupe key", () => {
    const portal = resolveNotificationRule("calendar_booking_completed")!;
    const webhook = resolveNotificationRule("consultation_booked")!;
    expect(buildDedupeKey("lead-1", portal, null)).toBe(buildDedupeKey("lead-1", webhook, null));
  });

  it("scopes the questionnaire key by version so a new version may notify again", () => {
    const rule = resolveNotificationRule("questionnaire_submitted")!;
    const v1 = buildDedupeKey("lead-1", rule, { questionnaireVersion: "1.0" });
    const v2 = buildDedupeKey("lead-1", rule, { questionnaireVersion: "2.0" });
    expect(v1).not.toBe(v2);
    // Different investors never share a key.
    expect(buildDedupeKey("lead-2", rule, { questionnaireVersion: "1.0" })).not.toBe(v1);
  });
});

// ---------------------------------------------------------------------------
// Event recording + dispatch.
// ---------------------------------------------------------------------------

describe("questionnaire completion notification", () => {
  it("records the event and emails the advisor", async () => {
    const lead = await makeStoredLead({
      qualification_result: "qualified",
      qualification_score: 72,
    });

    await recordLeadEvent(lead, "questionnaire_submitted", { questionnaireVersion: "1.0" });

    // The event itself is recorded regardless of notification outcome.
    const events = await store.getEventsForLead(lead.id);
    expect(events.map((e) => e.event_name)).toContain("questionnaire_submitted");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://api.resend.com/emails");

    const payload = sentPayload();
    expect(payload.to).toEqual(["default-advisor@example.test"]);
    expect(payload.subject).toBe(`Investor Qualification Completed — Dana ${lead.last_name}`);
    // Replying reaches the investor.
    expect(payload.reply_to).toEqual([lead.email]);

    const html = payload.html as string;
    expect(html).toContain("Qualified");
    expect(html).toContain("72");
    expect(html).toContain(`https://compass.example.test/advisor/investors/${lead.id}`);
    expect(html).toContain("View Investor");

    const deliveries = await store.listNotificationDeliveriesForLead(lead.id);
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0]).toMatchObject({
      status: "sent",
      channel: "email",
      template_key: "questionnaire_completed",
      provider: "resend",
      provider_message_id: "resend-msg-1",
      recipient: "default-advisor@example.test",
    });
    expect(deliveries[0].sent_at).toBeTruthy();
  });

  it("does not email twice when the same completion is recorded again", async () => {
    const lead = await makeStoredLead();

    await recordLeadEvent(lead, "questionnaire_submitted", { questionnaireVersion: "1.0" });
    await recordLeadEvent(lead, "questionnaire_submitted", { questionnaireVersion: "1.0" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await store.listNotificationDeliveriesForLead(lead.id)).toHaveLength(1);
  });

  it("does not email twice when a booking arrives from both the portal and the webhook", async () => {
    const lead = await makeStoredLead();

    await recordLeadEvent(lead, "calendar_booking_completed", { detectedVia: "embed-event" });
    await recordLeadEvent(lead, "consultation_booked", { externalAppointmentId: "appt-1" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await store.listNotificationDeliveriesForLead(lead.id)).toHaveLength(1);
  });

  it("writes no delivery row for dashboard-only activity", async () => {
    const lead = await makeStoredLead();

    await recordLeadEvent(lead, "portal_opened", null);
    await recordLeadEvent(lead, "video_progress_50", { percent: 50 });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(await store.listNotificationDeliveriesForLead(lead.id)).toHaveLength(0);
    // …but the activity is still on the record.
    const events = await store.getEventsForLead(lead.id);
    expect(events.map((e) => e.event_name)).toEqual(
      expect.arrayContaining(["portal_opened", "video_progress_50"]),
    );
  });
});

describe("delivery failures", () => {
  it("does not throw when the provider rejects the message, and records why", async () => {
    fetchMock.mockResolvedValue(errorResponse("Domain is not verified"));
    const lead = await makeStoredLead();

    // The investor's action must still succeed — this is the guarantee that
    // keeps questionnaire submission independent of email delivery.
    await expect(
      recordLeadEvent(lead, "questionnaire_submitted", { questionnaireVersion: "1.0" }),
    ).resolves.toBeUndefined();

    const [delivery] = await store.listNotificationDeliveriesForLead(lead.id);
    expect(delivery.status).toBe("failed");
    expect(delivery.error_message).toContain("Domain is not verified");
    expect(delivery.provider).toBe("resend");
    expect(delivery.sent_at).toBeNull();

    // The event itself was still recorded.
    const events = await store.getEventsForLead(lead.id);
    expect(events.map((e) => e.event_name)).toContain("questionnaire_submitted");
  });

  it("does not throw when the provider call itself blows up", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNRESET"));
    const lead = await makeStoredLead();

    await expect(
      recordLeadEvent(lead, "questionnaire_submitted", { questionnaireVersion: "1.0" }),
    ).resolves.toBeUndefined();

    const [delivery] = await store.listNotificationDeliveriesForLead(lead.id);
    expect(delivery.status).toBe("failed");
    expect(delivery.error_message).toContain("ECONNRESET");
  });
});

describe("recipient resolution", () => {
  it("prefers the investor's assigned advisor over the default inbox", async () => {
    const advisor = await store.createStaffUser({
      first_name: "Assigned",
      last_name: "Advisor",
      email: "assigned@example.test",
      password_hash: "x",
      role: "ADVISOR",
    });
    const lead = await makeStoredLead({ assigned_advisor_id: advisor.id });

    await recordLeadEvent(lead, "questionnaire_submitted", { questionnaireVersion: "1.0" });

    expect(sentPayload().to).toEqual(["assigned@example.test"]);
  });

  it("falls back to the default inbox when the assigned advisor is deactivated", async () => {
    const advisor = await store.createStaffUser({
      first_name: "Former",
      last_name: "Advisor",
      email: "former@example.test",
      password_hash: "x",
      role: "ADVISOR",
    });
    await store.updateStaffUser(advisor.id, { active: false });
    const lead = await makeStoredLead({ assigned_advisor_id: advisor.id });

    await recordLeadEvent(lead, "questionnaire_submitted", { questionnaireVersion: "1.0" });

    expect(sentPayload().to).toEqual(["default-advisor@example.test"]);
  });

  it("records a failed delivery, and sends nothing, when no recipient is configured", async () => {
    const previous = process.env.DEFAULT_ADVISOR_NOTIFICATION_EMAIL;
    delete process.env.DEFAULT_ADVISOR_NOTIFICATION_EMAIL;
    try {
      const lead = await makeStoredLead();
      await recordLeadEvent(lead, "questionnaire_submitted", { questionnaireVersion: "1.0" });

      expect(fetchMock).not.toHaveBeenCalled();
      const [delivery] = await store.listNotificationDeliveriesForLead(lead.id);
      expect(delivery.status).toBe("failed");
      expect(delivery.recipient).toBeNull();
      expect(delivery.error_message).toContain("No recipient");
    } finally {
      process.env.DEFAULT_ADVISOR_NOTIFICATION_EMAIL = previous;
    }
  });
});

describe("unconfigured environments", () => {
  it("sends nothing and claims no dedupe key when the provider is not configured", async () => {
    const previousKey = process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;
    const lead = await makeStoredLead();

    try {
      await recordLeadEvent(lead, "questionnaire_submitted", { questionnaireVersion: "1.0" });
      expect(fetchMock).not.toHaveBeenCalled();
      expect(await store.listNotificationDeliveriesForLead(lead.id)).toHaveLength(0);
    } finally {
      process.env.RESEND_API_KEY = previousKey;
    }

    // Configuring the key later must not be blocked by the earlier skip.
    await recordLeadEvent(lead, "questionnaire_submitted", { questionnaireVersion: "1.0" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
