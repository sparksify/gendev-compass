import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeStore } from "./fakeStore";
import type { PortalStore } from "@/lib/store/types";

let store: PortalStore;

vi.mock("@/lib/store", () => ({
  getStore: () => store,
}));

// Deterministic defaults for every test unless a test overrides them.
process.env.PORTAL_AUTO_MATCH_BEFORE_SECONDS = "120";
process.env.PORTAL_AUTO_MATCH_AFTER_SECONDS = "30";
process.env.PORTAL_ACTIVATION_MAX_WAIT_SECONDS = "30";
process.env.PORTAL_ACTIVATION_TTL_MINUTES = "15";
process.env.PORTAL_LAST_FOUR_MAX_ATTEMPTS = "5";
delete process.env.PORTAL_TIME_MATCHING_ENABLED;

const { startActivation, pollActivation, resolveLastFour } = await import("./service");

async function seedLead(
  store: PortalStore,
  overrides: Partial<Parameters<PortalStore["upsertExternalLead"]>[0]> = {},
) {
  const { record } = await store.upsertExternalLead({
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
  return record;
}

beforeEach(() => {
  store = createFakeStore();
});

describe("startActivation", () => {
  it("rejects an unknown brand", async () => {
    const result = await startActivation({ brandSlug: "not-a-real-brand" }, null);
    expect(result.ok).toBe(false);
  });

  it("creates a pending activation for a valid brand", async () => {
    const result = await startActivation({ brandSlug: "cmdt" }, null);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.record.status).toBe("pending");
      expect(result.record.public_activation_id).toBeTruthy();
    }
  });

  it("reuses an existing non-expired activation for the same brand (refresh/duplicate open)", async () => {
    const first = await startActivation({ brandSlug: "cmdt" }, null);
    if (!first.ok) throw new Error("expected ok");
    const second = await startActivation({ brandSlug: "cmdt" }, first.record.public_activation_id);
    if (!second.ok) throw new Error("expected ok");
    expect(second.record.id).toBe(first.record.id);

    const all = await store.listRecentActivations(10);
    expect(all).toHaveLength(1); // no duplicate row created
  });
});

describe("pollActivation — automatic matching", () => {
  it("matches and claims the single eligible lead, then provisions a portal user", async () => {
    await seedLead(store);
    const started = await startActivation({ brandSlug: "cmdt" }, null);
    if (!started.ok) throw new Error("expected ok");

    const result = await pollActivation(started.record);
    expect(result.status).toBe("ready");
    expect(result.portal_lead_id).toBeTruthy();

    const lead = await store.getLeadById(result.portal_lead_id as string);
    expect(lead?.brand_slug).toBe("cmdt");
    expect(lead?.email).toBe("jane@example.com");
  });

  it("does not match a lead delivered before the activation opened but outside the before-window", async () => {
    const tooEarly = new Date(Date.now() - 10 * 60_000).toISOString(); // 10 min before, window is 2 min
    await seedLead(store, { received_at: tooEarly });
    const started = await startActivation({ brandSlug: "cmdt" }, null);
    if (!started.ok) throw new Error("expected ok");

    const result = await pollActivation(started.record);
    expect(result.status).toBe("pending");
  });

  it("matches a lead that arrives before the activation page opens, inside the before-window", async () => {
    const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
    await seedLead(store, { received_at: oneMinuteAgo });
    const started = await startActivation({ brandSlug: "cmdt" }, null);
    if (!started.ok) throw new Error("expected ok");

    const result = await pollActivation(started.record);
    expect(result.status).toBe("ready");
  });

  it("matches a delayed lead that arrives shortly after the activation page opened", async () => {
    const started = await startActivation({ brandSlug: "cmdt" }, null);
    if (!started.ok) throw new Error("expected ok");

    // Nothing yet — still pending.
    expect((await pollActivation(started.record)).status).toBe("pending");

    // Lead arrives a moment later, inside the after-window.
    await seedLead(store, { received_at: new Date().toISOString() });
    const result = await pollActivation(started.record);
    expect(result.status).toBe("ready");
  });

  it("requires the last-four fallback when two simultaneous leads are plausible", async () => {
    await seedLead(store, { highlevel_contact_id: "contact-a" });
    await seedLead(store, { highlevel_contact_id: "contact-b" });
    const started = await startActivation({ brandSlug: "cmdt" }, null);
    if (!started.ok) throw new Error("expected ok");

    const result = await pollActivation(started.record);
    expect(result.status).toBe("fallback_required");
    expect(result.last_candidate_count).toBe(2);
  });

  it("expires an activation past its TTL and stops matching", async () => {
    await seedLead(store);
    const started = await startActivation({ brandSlug: "cmdt" }, null);
    if (!started.ok) throw new Error("expected ok");
    await store.updateActivation(started.record.id, {}); // no-op to fetch fresh below
    const expired = { ...started.record, expires_at: new Date(Date.now() - 1000).toISOString() };

    const result = await pollActivation(expired);
    expect(result.status).toBe("expired");
  });

  it("falls back after the max wait when no lead ever arrives", async () => {
    process.env.PORTAL_ACTIVATION_MAX_WAIT_SECONDS = "30";
    const started = await startActivation({ brandSlug: "cmdt" }, null);
    if (!started.ok) throw new Error("expected ok");
    // Simulate 31 elapsed seconds since creation.
    const stale = { ...started.record, created_at: new Date(Date.now() - 31_000).toISOString() };

    const result = await pollActivation(stale);
    expect(result.status).toBe("fallback_required");
    expect(result.last_failure_reason).toBe("no_match_within_window");
  });

  it("goes straight to fallback when time-based matching is disabled", async () => {
    process.env.PORTAL_TIME_MATCHING_ENABLED = "false";
    await seedLead(store);
    const started = await startActivation({ brandSlug: "cmdt" }, null);
    if (!started.ok) throw new Error("expected ok");

    const result = await pollActivation(started.record);
    expect(result.status).toBe("fallback_required");
    process.env.PORTAL_TIME_MATCHING_ENABLED = "true";
  });

  it("never lets two activations claim the same lead (atomic claim)", async () => {
    await seedLead(store);
    const first = await startActivation({ brandSlug: "cmdt" }, null);
    const second = await startActivation({ brandSlug: "cmdt", source: "other-session" }, null);
    if (!first.ok || !second.ok) throw new Error("expected ok");

    const [resultA, resultB] = await Promise.all([
      pollActivation(first.record),
      pollActivation(second.record),
    ]);

    const readyCount = [resultA, resultB].filter((r) => r.status === "ready").length;
    expect(readyCount).toBe(1);
  });

  it("reuses an existing portal user for the same brand + HighLevel contact instead of duplicating them", async () => {
    const existing = await store.createLead({
      portal_token: "existing-token",
      first_name: "Jane",
      last_name: "Prospect",
      email: "jane@example.com",
      phone: "12145551212",
      source: "facebook_lead_ad",
      campaign: null,
      ad_set: null,
      ad: null,
      facebook_lead_id: null,
      initial_liquid_capital: null,
      initial_net_worth: null,
      initial_business_owner: null,
      brand_slug: "cmdt",
      highlevel_contact_id: "same-contact",
      highlevel_location_id: "loc-1",
      advisor_id: null,
    });

    await seedLead(store, { highlevel_contact_id: "same-contact" });
    const started = await startActivation({ brandSlug: "cmdt" }, null);
    if (!started.ok) throw new Error("expected ok");
    const result = await pollActivation(started.record);

    expect(result.status).toBe("ready");
    expect(result.portal_lead_id).toBe(existing.id); // reused, not duplicated
  });

  it("gives an existing portal user access to a new brand instead of duplicating them", async () => {
    // Pre-existing lead for a *different* brand — same HighLevel contact would collide only within a brand.
    await store.createLead({
      portal_token: "existing-token",
      first_name: "Jane",
      last_name: "Prospect",
      email: "jane@example.com",
      phone: "12145551212",
      source: "facebook_lead_ad",
      campaign: null,
      ad_set: null,
      ad: null,
      facebook_lead_id: null,
      initial_liquid_capital: null,
      initial_net_worth: null,
      initial_business_owner: null,
      brand_slug: "other-brand",
      highlevel_contact_id: "existing-contact",
      highlevel_location_id: "loc-1",
      advisor_id: null,
    });

    await seedLead(store, { highlevel_contact_id: "existing-contact" });
    const started = await startActivation({ brandSlug: "cmdt" }, null);
    if (!started.ok) throw new Error("expected ok");
    const result = await pollActivation(started.record);

    expect(result.status).toBe("ready");
    const newLead = await store.getLeadById(result.portal_lead_id as string);
    expect(newLead?.brand_slug).toBe("cmdt");
    expect(newLead?.portal_token).not.toBe("existing-token"); // distinct brand engagement, not a duplicate account collision
  });
});

describe("resolveLastFour", () => {
  it("claims the single lead matching the submitted last four digits", async () => {
    await seedLead(store, { phone_last_four: "4821" });
    await seedLead(store, { phone_last_four: "9999" });
    const started = await startActivation({ brandSlug: "cmdt" }, null);
    if (!started.ok) throw new Error("expected ok");
    // Force ambiguity first so the fallback is the realistic entry point.
    const pending = await pollActivation(started.record);
    expect(pending.status).toBe("fallback_required");

    const result = await resolveLastFour(pending, "4821");
    expect(result.status).toBe("ready");
  });

  it("stays ambiguous ('manual_resolution_required') when last four still matches more than one lead", async () => {
    await seedLead(store, { phone_last_four: "4821" });
    await seedLead(store, { phone_last_four: "4821" });
    const started = await startActivation({ brandSlug: "cmdt" }, null);
    if (!started.ok) throw new Error("expected ok");
    const pending = await pollActivation(started.record);

    const result = await resolveLastFour(pending, "4821");
    expect(result.status).toBe("manual_resolution_required");
  });

  it("reports no_match for an incorrect last four without revealing anything", async () => {
    await seedLead(store, { phone_last_four: "4821" });
    await seedLead(store, { phone_last_four: "5555" }); // forces ambiguity so auto-match doesn't resolve it first
    const started = await startActivation({ brandSlug: "cmdt" }, null);
    if (!started.ok) throw new Error("expected ok");
    const pending = await pollActivation(started.record);
    expect(pending.status).toBe("fallback_required");

    const result = await resolveLastFour(pending, "0000");
    expect(result.status).toBe("fallback_required");
  });

  it("stops after the configured max attempts", async () => {
    process.env.PORTAL_LAST_FOUR_MAX_ATTEMPTS = "2";
    await seedLead(store, { phone_last_four: "4821" });
    await seedLead(store, { phone_last_four: "5555" }); // forces ambiguity so auto-match doesn't resolve it first
    const started = await startActivation({ brandSlug: "cmdt" }, null);
    if (!started.ok) throw new Error("expected ok");
    let activation = await pollActivation(started.record);
    expect(activation.status).toBe("fallback_required");

    await resolveLastFour(activation, "0000");
    activation = (await store.getActivationByPublicId(activation.public_activation_id)) as typeof activation;
    await resolveLastFour(activation, "0000");
    activation = (await store.getActivationByPublicId(activation.public_activation_id)) as typeof activation;

    const result = await resolveLastFour(activation, "4821"); // correct digits, but attempts exhausted
    expect(result.status).toBe("manual_resolution_required");
    process.env.PORTAL_LAST_FOUR_MAX_ATTEMPTS = "5";
  });

  it("reports expired for an activation past its TTL", async () => {
    const started = await startActivation({ brandSlug: "cmdt" }, null);
    if (!started.ok) throw new Error("expected ok");
    const expired = { ...started.record, expires_at: new Date(Date.now() - 1000).toISOString() };

    const result = await resolveLastFour(expired, "4821");
    expect(result.status).toBe("expired");
  });
});
