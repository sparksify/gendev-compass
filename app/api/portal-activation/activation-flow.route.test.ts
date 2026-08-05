import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeStore } from "@/lib/portalActivation/fakeStore";
import type { PortalStore } from "@/lib/store/types";

let store: PortalStore;

vi.mock("@/lib/store", () => ({
  getStore: () => store,
}));

const { POST: startPost } = await import("./start/route");
const { GET: statusGet } = await import("./status/route");
const { POST: lastFourPost } = await import("./phone-last-four/route");

beforeEach(() => {
  store = createFakeStore();
});

/** Pulls the activation cookie out of a Set-Cookie response header for reuse on the next request. */
function extractCookie(response: Response): string {
  const setCookie = response.headers.get("set-cookie");
  if (!setCookie) throw new Error("Expected a Set-Cookie header");
  return setCookie.split(";")[0];
}

function jsonRequest(url: string, body: unknown, cookie?: string): Request {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (cookie) headers["Cookie"] = cookie;
  return new Request(url, { method: "POST", headers, body: JSON.stringify(body) });
}

function getRequest(url: string, cookie?: string): Request {
  const headers: Record<string, string> = {};
  if (cookie) headers["Cookie"] = cookie;
  return new Request(url, { method: "GET", headers });
}

async function seedLead(overrides: Partial<Parameters<PortalStore["upsertExternalLead"]>[0]> = {}) {
  return store.upsertExternalLead({
    highlevel_contact_id: overrides.highlevel_contact_id ?? `contact-${Math.random()}`,
    highlevel_location_id: "loc-1",
    brand_slug: "cmdt",
    advisor_id: null,
    first_name: "Jane",
    last_name: "Prospect",
    normalized_email: "jane@example.com",
    normalized_phone: "12145551212",
    phone_last_four: "1212",
    source: "facebook_lead_ad",
    facebook_page_id: null,
    facebook_form_id: null,
    facebook_campaign_id: null,
    facebook_ad_id: null,
    submitted_at: new Date().toISOString(),
    received_at: new Date().toISOString(),
    ...overrides,
  });
}

describe("activation flow endpoints", () => {
  it("start → status walks a matched lead straight to a redirect URL", async () => {
    await seedLead();

    const startResponse = await startPost(
      jsonRequest("https://example.com/api/portal-activation/start", { brandSlug: "cmdt" }),
    );
    expect(startResponse.status).toBe(200);
    const startData = (await startResponse.json()) as { activationId: string; status: string };
    expect(startData.status).toBe("pending");
    const cookie = extractCookie(startResponse);

    const statusResponse = await statusGet(
      getRequest("https://example.com/api/portal-activation/status", cookie),
    );
    const statusData = (await statusResponse.json()) as { status: string; redirectUrl?: string };
    expect(statusData.status).toBe("ready");
    expect(statusData.redirectUrl).toMatch(/^\/p\//);
  });

  it("status without a cookie reports expired rather than erroring", async () => {
    const response = await statusGet(getRequest("https://example.com/api/portal-activation/status"));
    const data = (await response.json()) as { status: string };
    expect(data.status).toBe("expired");
  });

  it("rejects starting activation for an unknown brand", async () => {
    const response = await startPost(
      jsonRequest("https://example.com/api/portal-activation/start", { brandSlug: "unknown" }),
    );
    expect(response.status).toBe(400);
  });

  it("never exposes lead details in the status response before a match", async () => {
    await seedLead();
    await seedLead(); // ambiguous on purpose
    const startResponse = await startPost(
      jsonRequest("https://example.com/api/portal-activation/start", { brandSlug: "cmdt" }),
    );
    const cookie = extractCookie(startResponse);

    const statusResponse = await statusGet(
      getRequest("https://example.com/api/portal-activation/status", cookie),
    );
    const raw = await statusResponse.text();
    expect(raw).not.toMatch(/jane@example\.com/i);
    expect(raw).not.toMatch(/12145551212/);
    expect(JSON.parse(raw)).toEqual({ status: "fallback_required", fallbackType: "phone_last_four" });
  });

  it("resolves via the last-four fallback end to end", async () => {
    await seedLead({ phone_last_four: "4821" });
    await seedLead({ phone_last_four: "9999" });

    const startResponse = await startPost(
      jsonRequest("https://example.com/api/portal-activation/start", { brandSlug: "cmdt" }),
    );
    const cookie = extractCookie(startResponse);
    await statusGet(getRequest("https://example.com/api/portal-activation/status", cookie)); // triggers the ambiguity check

    const lastFourResponse = await lastFourPost(
      jsonRequest(
        "https://example.com/api/portal-activation/phone-last-four",
        { phoneLastFour: "4821" },
        cookie,
      ),
    );
    const data = (await lastFourResponse.json()) as { status: string; redirectUrl?: string };
    expect(data.status).toBe("ready");
    expect(data.redirectUrl).toMatch(/^\/p\//);
  });

  it("rejects a malformed last-four submission", async () => {
    const startResponse = await startPost(
      jsonRequest("https://example.com/api/portal-activation/start", { brandSlug: "cmdt" }),
    );
    const cookie = extractCookie(startResponse);

    const response = await lastFourPost(
      jsonRequest(
        "https://example.com/api/portal-activation/phone-last-four",
        { phoneLastFour: "12" },
        cookie,
      ),
    );
    expect(response.status).toBe(400);
  });

  it("reuses the same activation across a page refresh (same cookie, no duplicate row)", async () => {
    const first = await startPost(
      jsonRequest("https://example.com/api/portal-activation/start", { brandSlug: "cmdt" }),
    );
    const cookie = extractCookie(first);
    const firstData = (await first.json()) as { activationId: string };

    const second = await startPost(
      jsonRequest("https://example.com/api/portal-activation/start", { brandSlug: "cmdt" }, cookie),
    );
    const secondData = (await second.json()) as { activationId: string };

    expect(secondData.activationId).toBe(firstData.activationId);
    const all = await store.listRecentActivations(10);
    expect(all).toHaveLength(1);
  });
});
