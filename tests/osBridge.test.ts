/**
 * AI Employee OS bridge, exercised through recordLeadEvent (the same entry
 * point every route handler uses) with only the outbound HTTP call stubbed —
 * mirroring tests/notifications.test.ts. Policy assertions hit the rules
 * module directly.
 */
import { createHmac } from "crypto";
import { mkdtempSync, rmSync } from "fs";
import os from "os";
import path from "path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PortalStore } from "@/lib/store/types";
import type { LeadRecord } from "@/types/lead";

const tmpDir = mkdtempSync(path.join(os.tmpdir(), "os-bridge-test-"));
const originalCwd = process.cwd();

let store: PortalStore;
let recordLeadEvent: typeof import("@/lib/domain/activities").recordLeadEvent;
let resolveBridgeEvent: typeof import("@/lib/os-bridge/rules").resolveBridgeEvent;

let fetchMock: ReturnType<typeof vi.fn>;

beforeAll(async () => {
  process.chdir(tmpDir);
  process.env.OS_BRIDGE_WEBHOOK_URL = "https://os.example.test/api/webhooks/compass";
  process.env.OS_BRIDGE_WEBHOOK_SECRET = "bridge-secret";
  process.env.OS_BRIDGE_BRAND = "cmdt";

  const storeModule = await import("@/lib/store");
  store = storeModule.getStore();
  ({ recordLeadEvent } = await import("@/lib/domain/activities"));
  ({ resolveBridgeEvent } = await import("@/lib/os-bridge/rules"));
});

afterAll(() => {
  process.chdir(originalCwd);
  rmSync(tmpDir, { recursive: true, force: true });
});

beforeEach(() => {
  fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

let seq = 0;

async function makeStoredLead(): Promise<LeadRecord> {
  seq += 1;
  return store.createLead({
    portal_token: `bridge-token-${seq}-0123456789abcdef`,
    first_name: "Dana",
    last_name: `Investor${seq}`,
    email: `dana-bridge-${seq}@example.test`,
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
}

/** Calls to the OS bridge URL (notifications also share the fetch stub). */
function bridgeCalls() {
  return fetchMock.mock.calls.filter(
    (c) => String(c[0]).includes("os.example.test")
  );
}

describe("bridge rules", () => {
  it("forwards funnel milestones and appointment-shaped events", () => {
    expect(resolveBridgeEvent("video_progress_50")).toBe("video_progress_50");
    expect(resolveBridgeEvent("questionnaire_submitted")).toBe("questionnaire_submitted");
    expect(resolveBridgeEvent("consultation_no_show")).toBe("consultation_no_show");
    expect(resolveBridgeEvent("fdd_sent")).toBe("fdd_sent");
  });

  it("normalizes the client_ spoof-guard prefix for questionnaire_started", () => {
    expect(resolveBridgeEvent("client_questionnaire_started")).toBe("questionnaire_started");
  });

  it("does not forward noise", () => {
    expect(resolveBridgeEvent("video_progress_25")).toBeNull();
    expect(resolveBridgeEvent("faq_opened")).toBeNull();
    expect(resolveBridgeEvent("client_device_info")).toBeNull();
    expect(resolveBridgeEvent("note_added")).toBeNull();
  });
});

describe("bridge dispatch through recordLeadEvent", () => {
  it("POSTs a signed envelope for forwarded events", async () => {
    const lead = await makeStoredLead();
    await recordLeadEvent(lead, "questionnaire_submitted", { score: 9 }, null, {
      source: "portal",
    });

    const calls = bridgeCalls();
    expect(calls.length).toBe(1);
    const [, init] = calls[0] as [string, { body: string; headers: Record<string, string> }];
    const envelope = JSON.parse(init.body);
    expect(envelope.event).toBe("questionnaire_submitted");
    expect(envelope.lead.id).toBe(lead.id);
    expect(envelope.lead.brand).toBe("cmdt");
    expect(envelope.eventId).toBeTruthy();

    const expected = `sha256=${createHmac("sha256", "bridge-secret").update(init.body).digest("hex")}`;
    expect(init.headers["x-compass-signature"]).toBe(expected);
  });

  it("stays silent for non-forwarded events", async () => {
    const lead = await makeStoredLead();
    await recordLeadEvent(lead, "faq_opened", null, null, { source: "portal" });
    expect(bridgeCalls().length).toBe(0);
  });

  it("a failing bridge call never breaks event recording", async () => {
    fetchMock.mockImplementation(async () => {
      throw new Error("network down");
    });
    const lead = await makeStoredLead();
    await expect(
      recordLeadEvent(lead, "video_progress_50", { percent: 50 }, null, { source: "portal" })
    ).resolves.toBeUndefined();
    const events = await store.getEventsForLead(lead.id);
    expect(events.some((e: { event_name: string }) => e.event_name === "video_progress_50")).toBe(true);
  });
});
