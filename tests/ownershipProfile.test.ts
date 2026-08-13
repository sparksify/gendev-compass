/**
 * Ownership Profile persistence and its completion notification, driven
 * through the real route handler against the file-backed dev store. Only the
 * outbound email call is stubbed.
 *
 * The behaviour that matters here is the seam between "saved continuously"
 * and "completed once": autosaves must be free, and completion must notify
 * exactly one time no matter how often the client re-sends it.
 */
import { mkdtempSync, rmSync } from "fs";
import os from "os";
import path from "path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PortalStore } from "@/lib/store/types";
import type { LeadRecord } from "@/types/lead";

const tmpDir = mkdtempSync(path.join(os.tmpdir(), "ownership-profile-test-"));
const originalCwd = process.cwd();

let store: PortalStore;
let POST: typeof import("@/app/api/portal/[token]/ownership-profile/route").POST;
let GET: typeof import("@/app/api/portal/[token]/ownership-profile/route").GET;
let resolveNotificationRule: typeof import("@/lib/notifications/rules").resolveNotificationRule;

let fetchMock: ReturnType<typeof vi.fn>;

beforeAll(async () => {
  process.chdir(tmpDir);
  process.env.RESEND_API_KEY = "re_test_key";
  process.env.NOTIFICATION_FROM_EMAIL = "Compass <compass@example.test>";
  process.env.DEFAULT_ADVISOR_NOTIFICATION_EMAIL = "advisor@example.test";

  const storeModule = await import("@/lib/store");
  store = storeModule.getStore();
  ({ POST, GET } = await import("@/app/api/portal/[token]/ownership-profile/route"));
  ({ resolveNotificationRule } = await import("@/lib/notifications/rules"));
});

afterAll(() => {
  process.chdir(originalCwd);
  rmSync(tmpDir, { recursive: true, force: true });
});

beforeEach(() => {
  fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "msg-1" }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

let seq = 0;

async function makeLead(): Promise<LeadRecord> {
  seq += 1;
  return store.createLead({
    portal_token: `ownership-token-${seq}-0123456789abcdef`,
    first_name: "Rosa",
    last_name: `Investor${seq}`,
    email: `rosa${seq}@example.test`,
    phone: null,
    state: "Ohio",
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

function save(lead: LeadRecord, body: Record<string, unknown>) {
  return POST(
    new Request("http://localhost/api/portal/x/ownership-profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ token: lead.portal_token }) },
  );
}

const PARTIAL = {
  motivations: ["long-term-wealth", "freedom"],
  activities: ["leading-team"],
  ownershipStyle: 30,
  currentStep: 3,
};

const FULL = {
  ...PARTIAL,
  growthComfort: "a-few-locations",
  environments: ["healthcare", "b2b-services"],
  priorities: ["recurring-revenue", "scalability"],
  experience: ["business-owner"],
  timeline: "actively-evaluating",
  currentStep: 8,
  completed: true,
};

describe("progressive saving", () => {
  it("persists a partial profile without notifying anyone", async () => {
    const lead = await makeLead();

    const response = await save(lead, PARTIAL);
    expect(response.status).toBe(200);

    const profile = await store.getOwnershipProfile(lead.id);
    expect(profile).toMatchObject({
      motivations: ["long-term-wealth", "freedom"],
      activities: ["leading-team"],
      ownership_style: 30,
      current_step: 3,
      completed_at: null,
    });
    // Sections answered: motivations, activities, ownership style (always).
    expect(profile?.answered_sections).toBe(3);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(await store.listNotificationDeliveriesForLead(lead.id)).toHaveLength(0);
  });

  it("keeps upserting the same row as answers accumulate", async () => {
    const lead = await makeLead();

    await save(lead, PARTIAL);
    await save(lead, { ...PARTIAL, environments: ["retail"], currentStep: 5 });

    const all = await store.listOwnershipProfiles();
    expect(all.filter((p) => p.lead_id === lead.id)).toHaveLength(1);

    const profile = await store.getOwnershipProfile(lead.id);
    expect(profile?.environments).toEqual(["retail"]);
    expect(profile?.current_step).toBe(5);
  });

  it("scopes profiles to the portal token's own lead", async () => {
    const one = await makeLead();
    const two = await makeLead();

    await save(one, { ...PARTIAL, ownershipStyle: 10 });
    await save(two, { ...PARTIAL, ownershipStyle: 90 });

    expect((await store.getOwnershipProfile(one.id))?.ownership_style).toBe(10);
    expect((await store.getOwnershipProfile(two.id))?.ownership_style).toBe(90);
  });

  it("reads the profile back for a returning investor", async () => {
    const lead = await makeLead();
    await save(lead, PARTIAL);

    const response = await GET(new Request("http://localhost/x"), {
      params: Promise.resolve({ token: lead.portal_token }),
    });
    const data = (await response.json()) as {
      success: boolean;
      profile: { current_step: number } | null;
    };

    expect(data.success).toBe(true);
    expect(data.profile?.current_step).toBe(3);
  });
});

describe("completion", () => {
  it("stamps completion, records the event, and emails the advisor once", async () => {
    const lead = await makeLead();

    await save(lead, PARTIAL);
    expect(fetchMock).not.toHaveBeenCalled();

    await save(lead, FULL);

    const profile = await store.getOwnershipProfile(lead.id);
    expect(profile?.completed_at).toBeTruthy();
    expect(profile?.answered_sections).toBe(8);

    const events = await store.getEventsForLead(lead.id);
    expect(events.filter((e) => e.event_name === "ownership_profile_completed")).toHaveLength(1);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse((fetchMock.mock.calls[0]?.[1] as { body: string }).body) as {
      subject: string;
      html: string;
      to: string[];
    };
    expect(body.subject).toBe(`Ownership Profile Completed — Rosa ${lead.last_name}`);
    expect(body.to).toEqual(["advisor@example.test"]);
    // Labels, not stored option keys.
    expect(body.html).toContain("Build long-term wealth");
    expect(body.html).toContain("Hands-on Owner");
    expect(body.html).toContain("Actively evaluating");
    expect(body.html).not.toContain("long-term-wealth");

    const [delivery] = await store.listNotificationDeliveriesForLead(lead.id);
    expect(delivery.status).toBe("sent");
    expect(delivery.template_key).toBe("ownership_profile_completed");
  });

  it("does not notify again when a finished profile is re-saved", async () => {
    const lead = await makeLead();

    await save(lead, FULL);
    await save(lead, FULL);
    await save(lead, { ...FULL, priorities: ["mission-driven"] });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const events = await store.getEventsForLead(lead.id);
    expect(events.filter((e) => e.event_name === "ownership_profile_completed")).toHaveLength(1);
    expect(await store.listNotificationDeliveriesForLead(lead.id)).toHaveLength(1);
  });

  it("keeps completion sticky when the investor reopens to edit", async () => {
    const lead = await makeLead();
    await save(lead, FULL);

    // beginEditing() sends completed:false; the stored completion stands.
    await save(lead, { ...FULL, completed: false, currentStep: 2 });

    const profile = await store.getOwnershipProfile(lead.id);
    expect(profile?.completed_at).toBeTruthy();
    expect(profile?.current_step).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("still saves the profile when the notification fails", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ message: "nope" }), { status: 422 }));
    const lead = await makeLead();

    const response = await save(lead, FULL);

    expect(response.status).toBe(200);
    expect((await store.getOwnershipProfile(lead.id))?.completed_at).toBeTruthy();
    const [delivery] = await store.listNotificationDeliveriesForLead(lead.id);
    expect(delivery.status).toBe("failed");
  });
});

describe("input validation", () => {
  it("rejects an option value that is not in the catalog", async () => {
    const lead = await makeLead();
    const response = await save(lead, { ...PARTIAL, motivations: ["become-a-pirate"] });

    expect(response.status).toBe(400);
    expect(await store.getOwnershipProfile(lead.id)).toBeNull();
  });

  it("enforces the selection limits server-side, not just in the UI", async () => {
    const lead = await makeLead();
    const response = await save(lead, {
      ...PARTIAL,
      // The UI caps activities at 3.
      activities: ["leading-team", "sales-networking", "operations", "marketing"],
    });

    expect(response.status).toBe(400);
  });

  it("rejects an out-of-range ownership style", async () => {
    const lead = await makeLead();
    expect((await save(lead, { ...PARTIAL, ownershipStyle: 150 })).status).toBe(400);
  });

  it("rejects an unknown portal token", async () => {
    const response = await POST(
      new Request("http://localhost/x", {
        method: "POST",
        body: JSON.stringify(PARTIAL),
      }),
      { params: Promise.resolve({ token: "not-a-real-token-0123456789" }) },
    );
    expect(response.status).toBe(404);
  });
});

describe("notification policy", () => {
  it("emails on completion but stays silent when the page is merely opened", () => {
    expect(resolveNotificationRule("ownership_profile_completed")?.action).toBe("immediate_email");
    expect(resolveNotificationRule("ownership_profile_opened")).toBeNull();
  });
});
