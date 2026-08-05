import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeStore } from "@/lib/portalActivation/fakeStore";
import type { PortalStore } from "@/lib/store/types";

let store: PortalStore;

vi.mock("@/lib/store", () => ({
  getStore: () => store,
}));

process.env.HIGHLEVEL_INBOUND_WEBHOOK_SECRET = "test-secret";

const { POST } = await import("./route");

beforeEach(() => {
  store = createFakeStore();
});

function makeRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("https://example.com/api/integrations/highlevel/facebook-lead", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer test-secret", ...headers },
    body: JSON.stringify(body),
  });
}

const VALID_PAYLOAD = {
  contactId: "contact-123",
  locationId: "loc-1",
  firstName: "Test",
  lastName: "Lead",
  email: "test@example.com",
  phone: "+12145551212",
  brandSlug: "cmdt",
  source: "facebook_lead_ad",
  submittedAt: new Date().toISOString(),
};

describe("POST /api/integrations/highlevel/facebook-lead", () => {
  it("rejects a missing/invalid webhook secret", async () => {
    const response = await POST(makeRequest(VALID_PAYLOAD, { Authorization: "Bearer wrong" }));
    expect(response.status).toBe(401);
  });

  it("accepts a valid payload and stores it unclaimed", async () => {
    const response = await POST(makeRequest(VALID_PAYLOAD));
    const data = (await response.json()) as { success: boolean; duplicate: boolean };
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.duplicate).toBe(false);

    const leads = await store.listRecentExternalLeads(10);
    expect(leads).toHaveLength(1);
    expect(leads[0].claimed_at).toBeNull();
    expect(leads[0].phone_last_four).toBe("1212");
  });

  it("handles a duplicate delivery of the same contact idempotently (no second row)", async () => {
    await POST(makeRequest(VALID_PAYLOAD));
    const response = await POST(makeRequest(VALID_PAYLOAD));
    const data = (await response.json()) as { success: boolean; duplicate: boolean };

    expect(data.success).toBe(true);
    expect(data.duplicate).toBe(true);
    const leads = await store.listRecentExternalLeads(10);
    expect(leads).toHaveLength(1);
  });

  it("rejects an unknown brand", async () => {
    const response = await POST(makeRequest({ ...VALID_PAYLOAD, brandSlug: "not-a-real-brand" }));
    expect(response.status).toBe(400);
    const leads = await store.listRecentExternalLeads(10);
    expect(leads).toHaveLength(0);
  });

  it("rejects a payload missing required fields", async () => {
    const response = await POST(makeRequest({ brandSlug: "cmdt" }));
    expect(response.status).toBe(400);
  });

  it("provisions the portal user immediately, before any activation click", async () => {
    const response = await POST(makeRequest(VALID_PAYLOAD));
    const data = (await response.json()) as { success: boolean; portalLinkSynced: boolean };
    expect(data.success).toBe(true);
    // No GHL_API_TOKEN in the test env — sync is skipped, never an error.
    expect(data.portalLinkSynced).toBe(false);

    const lead = await store.getLeadByBrandAndHighLevelContact("cmdt", "contact-123");
    expect(lead).not.toBeNull();
    expect(lead?.portal_token).toBeTruthy();
    expect(lead?.email).toBe("test@example.com");
  });

  it("does not create a second portal user on a duplicate webhook delivery", async () => {
    await POST(makeRequest(VALID_PAYLOAD));
    await POST(makeRequest(VALID_PAYLOAD));

    const lead = await store.getLeadByBrandAndHighLevelContact("cmdt", "contact-123");
    expect(lead).not.toBeNull();
    // Only one row overall — provisioning is idempotent per (brand, contact).
    const allLeads = await store.listRecentExternalLeads(10);
    expect(allLeads).toHaveLength(1);
  });
});
