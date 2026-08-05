/**
 * Platform domain model tests against the file-backed dev store (same
 * PortalStore interface as Supabase). Covers the lead → client →
 * opportunity chain, multi-opportunity behavior, membership authorization,
 * opportunity-scoped FDD workflows, external mappings, and the centralized
 * activity service. SQL migration + backfill behavior is covered separately
 * by scripts/test-migrations.sh against a real PostgreSQL cluster.
 */
import { mkdtempSync, rmSync } from "fs";
import os from "os";
import path from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PortalStore } from "@/lib/store/types";
import type { LeadRecord } from "@/types/lead";
import type { StaffUserRecord } from "@/types/advisor";

const tmpDir = mkdtempSync(path.join(os.tmpdir(), "domain-model-test-"));
const originalCwd = process.cwd();

let store: PortalStore;
let ensureLeadDomainChain: typeof import("@/lib/domain/chain").ensureLeadDomainChain;
let resolveAdvisorContext: typeof import("@/lib/domain/memberships").resolveAdvisorContext;
let canAccessOpportunity: typeof import("@/lib/domain/memberships").canAccessOpportunity;
let resolveDefaultOrganization: typeof import("@/lib/domain/organizations").resolveDefaultOrganization;
let findDuplicateCandidates: typeof import("@/lib/domain/clients").findDuplicateCandidates;
let closeOpportunity: typeof import("@/lib/domain/opportunities").closeOpportunity;
let setStageManually: typeof import("@/lib/advisor/stages").setStageManually;
let requestFdd: typeof import("@/lib/fdd/workflow").requestFdd;
let applyFddProviderEvent: typeof import("@/lib/fdd/workflow").applyFddProviderEvent;
let fddIdempotencyKey: typeof import("@/lib/fdd/workflow").fddIdempotencyKey;
let recordLeadEvent: typeof import("@/lib/domain/activities").recordLeadEvent;
let loadPortalContext: typeof import("@/lib/portal/context").loadPortalContext;
let hashPassword: typeof import("@/lib/advisor/password").hashPassword;

beforeAll(async () => {
  process.chdir(tmpDir);
  const storeModule = await import("@/lib/store");
  store = storeModule.getStore();
  ({ ensureLeadDomainChain } = await import("@/lib/domain/chain"));
  ({ resolveAdvisorContext, canAccessOpportunity } = await import("@/lib/domain/memberships"));
  ({ resolveDefaultOrganization } = await import("@/lib/domain/organizations"));
  ({ findDuplicateCandidates } = await import("@/lib/domain/clients"));
  ({ closeOpportunity } = await import("@/lib/domain/opportunities"));
  ({ setStageManually } = await import("@/lib/advisor/stages"));
  ({ requestFdd, applyFddProviderEvent, fddIdempotencyKey } = await import("@/lib/fdd/workflow"));
  ({ recordLeadEvent } = await import("@/lib/domain/activities"));
  ({ loadPortalContext } = await import("@/lib/portal/context"));
  ({ hashPassword } = await import("@/lib/advisor/password"));
});

afterAll(() => {
  process.chdir(originalCwd);
  rmSync(tmpDir, { recursive: true, force: true });
});

let tokenCounter = 0;
async function createLead(overrides: Partial<Parameters<PortalStore["createLead"]>[0]> = {}): Promise<LeadRecord> {
  tokenCounter += 1;
  return store.createLead({
    portal_token: `domain-token-${tokenCounter}-0123456789abcdef`,
    first_name: "Domain",
    last_name: `Lead${tokenCounter}`,
    email: `domain-lead${tokenCounter}@example.test`,
    phone: null,
    source: "test",
    campaign: null,
    ad_set: null,
    ad: null,
    facebook_lead_id: null,
    initial_liquid_capital: null,
    initial_net_worth: null,
    initial_business_owner: null,
    ...overrides,
  });
}

let staffCounter = 0;
async function createStaff(role: "ADMIN" | "ADVISOR"): Promise<StaffUserRecord> {
  staffCounter += 1;
  return store.createStaffUser({
    first_name: "Staff",
    last_name: `User${staffCounter}`,
    email: `staff${staffCounter}@example.test`,
    password_hash: hashPassword("test-password-123"),
    role,
  });
}

describe("lead domain chain", () => {
  it("creates organization, brand, client, and opportunity for a lead", async () => {
    const lead = await createLead();
    const chain = await ensureLeadDomainChain(lead);

    expect(chain.organization.slug).toBe("gendev");
    expect(chain.brand.slug).toBe("default");
    expect(chain.client.source_lead_id).toBe(lead.id);
    expect(chain.client.email).toBe(lead.email);
    expect(chain.opportunity.source_lead_id).toBe(lead.id);
    expect(chain.opportunity.client_id).toBe(chain.client.id);
    expect(chain.lead.client_id).toBe(chain.client.id);
    expect(chain.lead.primary_opportunity_id).toBe(chain.opportunity.id);
    expect(chain.lead.organization_id).toBe(chain.organization.id);
    expect(chain.lead.brand_id).toBe(chain.brand.id);
  });

  it("is idempotent: repeated runs never duplicate clients or opportunities", async () => {
    const lead = await createLead();
    const first = await ensureLeadDomainChain(lead);
    const again = await ensureLeadDomainChain(first.lead);
    const stale = await ensureLeadDomainChain(lead); // pre-link snapshot

    expect(again.client.id).toBe(first.client.id);
    expect(again.opportunity.id).toBe(first.opportunity.id);
    expect(stale.client.id).toBe(first.client.id);
    expect(stale.opportunity.id).toBe(first.opportunity.id);
  });

  it("copies stage, qualification, and advisor assignment onto the opportunity", async () => {
    const advisor = await createStaff("ADVISOR");
    await resolveAdvisorContext(advisor); // profile + membership exist
    let lead = await createLead();
    lead = await store.updateLead(lead.id, {
      current_stage: "QUESTIONNAIRE_COMPLETED",
      assigned_advisor_id: advisor.id,
      qualification_score: 85,
      qualification_result: "qualified",
    });

    const chain = await ensureLeadDomainChain(lead);
    expect(chain.opportunity.stage).toBe("QUESTIONNAIRE_COMPLETED");
    expect(chain.opportunity.qualification_score).toBe(85);
    expect(chain.opportunity.qualification_result).toBe("qualified");
    const profile = await store.getProfileByLegacyStaffUserId(advisor.id);
    expect(chain.opportunity.assigned_advisor_profile_id).toBe(profile?.id);
    const assignments = await store.listAssignmentsForOpportunity(chain.opportunity.id);
    expect(assignments).toHaveLength(1);
    expect(assignments[0].assignment_role).toBe("PRIMARY_ADVISOR");
  });

  it("surfaces duplicate candidates without merging", async () => {
    const email = "shared-email@example.test";
    const leadA = await createLead({ email });
    const leadB = await createLead({ email });
    const chainA = await ensureLeadDomainChain(leadA);
    const chainB = await ensureLeadDomainChain(leadB);

    expect(chainA.client.id).not.toBe(chainB.client.id); // never merged
    const candidates = await findDuplicateCandidates(
      chainA.organization.id,
      { email },
      chainA.client.id,
    );
    expect(candidates.map((c) => c.id)).toContain(chainB.client.id);
  });
});

describe("multi-opportunity clients", () => {
  it("supports two opportunities with different brands, stages, and FDD state", async () => {
    const lead = await createLead();
    const chain = await ensureLeadDomainChain(lead);
    const org = chain.organization;

    const brand2 = await store.createBrand({
      organization_id: org.id,
      name: "Brand Two",
      slug: `brand-two-${tokenCounter}`,
    });
    const second = await store.createOpportunity({
      organization_id: org.id,
      client_id: chain.client.id,
      brand_id: brand2.id,
      stage: "ENGAGED",
    });

    const all = await store.listOpportunitiesForClient(chain.client.id);
    expect(all).toHaveLength(2);
    expect(new Set(all.map((o) => o.brand_id)).size).toBe(2);
    expect(new Set(all.map((o) => o.stage)).size).toBe(2);

    // Independent FDD workflows per opportunity.
    const wf2 = await store.createFddWorkflow({
      organization_id: org.id,
      client_id: chain.client.id,
      opportunity_id: second.id,
      brand_id: brand2.id,
    });
    expect(wf2.opportunity_id).toBe(second.id);
    await expect(
      store.createFddWorkflow({
        organization_id: org.id,
        client_id: chain.client.id,
        opportunity_id: second.id,
        brand_id: brand2.id,
      }),
    ).rejects.toThrow(/already exists/);

    // Territory request belongs to the specific opportunity.
    const territory = await store.createTerritoryRequest({
      organization_id: org.id,
      client_id: chain.client.id,
      opportunity_id: second.id,
      brand_id: brand2.id,
      query_text: "Austin, TX",
    });
    expect(territory.status).toBe("pending");
    const forSecond = await store.listTerritoryRequestsForOpportunity(second.id);
    const forFirst = await store.listTerritoryRequestsForOpportunity(chain.opportunity.id);
    expect(forSecond).toHaveLength(1);
    expect(forFirst).toHaveLength(0);

    // Closing one opportunity does not close the other.
    await closeOpportunity(second, "lost", "Chose another brand");
    const after = await store.listOpportunitiesForClient(chain.client.id);
    expect(after.find((o) => o.id === second.id)?.status).toBe("lost");
    expect(after.find((o) => o.id === chain.opportunity.id)?.status).toBe("open");
  });
});

describe("advisor authorization through memberships", () => {
  it("resolves a legacy staff session user to profile and membership", async () => {
    const staff = await createStaff("ADVISOR");
    const ctx = await resolveAdvisorContext(staff);
    expect(ctx.profile.legacy_staff_user_id).toBe(staff.id);
    expect(ctx.membership.role).toBe("ADVISOR");
    expect(ctx.membership.status).toBe("active");
    // Idempotent: same profile + membership on repeat resolution.
    const again = await resolveAdvisorContext(staff);
    expect(again.profile.id).toBe(ctx.profile.id);
    expect(again.membership.id).toBe(ctx.membership.id);
  });

  it("maps ADMIN staff to ORGANIZATION_ADMIN with in-org access", async () => {
    const admin = await createStaff("ADMIN");
    const ctx = await resolveAdvisorContext(admin);
    expect(ctx.membership.role).toBe("ORGANIZATION_ADMIN");

    const lead = await createLead();
    const chain = await ensureLeadDomainChain(lead);
    expect(canAccessOpportunity(ctx, chain.opportunity, false)).toBe(true);
  });

  it("denies access across organizations and for inactive memberships", async () => {
    const advisor = await createStaff("ADVISOR");
    const ctx = await resolveAdvisorContext(advisor);
    const lead = await createLead();
    const chain = await ensureLeadDomainChain(lead);

    // Another organization's opportunity is invisible even in sees-all mode.
    const otherOpportunity = { ...chain.opportunity, organization_id: "other-org-id" };
    expect(canAccessOpportunity(ctx, otherOpportunity, true)).toBe(false);

    // Unassigned advisor without sees-all is denied; assigned is allowed.
    expect(canAccessOpportunity(ctx, chain.opportunity, false)).toBe(false);
    const assigned = {
      ...chain.opportunity,
      assigned_advisor_profile_id: ctx.profile.id,
    };
    expect(canAccessOpportunity(ctx, assigned, false)).toBe(true);

    // Inactive membership is denied everywhere.
    const inactiveCtx = {
      ...ctx,
      membership: { ...ctx.membership, status: "inactive" as const },
    };
    expect(canAccessOpportunity(inactiveCtx, assigned, true)).toBe(false);
  });
});

describe("opportunity-scoped FDD workflows", () => {
  it("creates and synchronizes the workflow from the lead FDD mirror", async () => {
    const lead = await createLead();
    const result = await requestFdd(lead, { source: "test", actor: "prospect" });
    expect(result.ok).toBe(true);

    const updated = await store.getLeadById(lead.id);
    expect(updated?.fdd_status).toBe("fdd_sent"); // simulated dispatch confirms

    const opportunity = await store.getOpportunityBySourceLeadId(lead.id);
    expect(opportunity).not.toBeNull();
    const workflow = await store.getFddWorkflowByOpportunityId(opportunity!.id);
    expect(workflow?.status).toBe("fdd_sent");
    expect(workflow?.request_source).toBe("test");

    // Audit entries carry the opportunity linkage.
    const audit = await store.listFddAudit(lead.id);
    expect(audit.length).toBeGreaterThan(0);
    expect(audit.every((entry) => entry.opportunity_id === opportunity!.id)).toBe(true);

    // Idempotency: a second request is a no-op, not a resend.
    const repeat = await requestFdd(updated!, { source: "test", actor: "prospect" });
    expect(repeat.alreadyRequested).toBe(true);
  });

  it("scopes idempotency keys per opportunity, not per client", async () => {
    const lead = await createLead();
    const chain = await ensureLeadDomainChain(lead);
    const keyPrimary = fddIdempotencyKey(chain.lead, chain.opportunity.id);
    const keyOther = fddIdempotencyKey(chain.lead, "another-opportunity-id");
    expect(keyPrimary).not.toBe(keyOther);
  });

  it("keeps lead mirror and workflow in sync through provider webhooks", async () => {
    const lead = await createLead();
    await requestFdd(lead, { source: "test", actor: "prospect" });

    const received = await applyFddProviderEvent(
      {
        event: "fdd_received",
        prospect_id: lead.id,
        envelope_id: "env-domain-1",
        event_id: "evt-domain-1",
      },
      null,
    );
    expect(received.ok).toBe(true);

    const updated = await store.getLeadById(lead.id);
    expect(updated?.fdd_status).toBe("waiting_period_active");
    const opportunity = await store.getOpportunityBySourceLeadId(lead.id);
    const workflow = await store.getFddWorkflowByOpportunityId(opportunity!.id);
    expect(workflow?.status).toBe("waiting_period_active");
    expect(workflow?.provider_envelope_id).toBe("env-domain-1");
    expect(workflow?.received_at).toBe(updated?.fdd_received_at);

    // Replay protection intact.
    const replay = await applyFddProviderEvent(
      {
        event: "fdd_received",
        prospect_id: lead.id,
        envelope_id: "env-domain-1",
        event_id: "evt-domain-1",
      },
      null,
    );
    expect(replay.duplicate).toBe(true);

    // Out-of-order safety: a late 'delivered' never regresses the status.
    await applyFddProviderEvent(
      {
        event: "fdd_delivered",
        prospect_id: lead.id,
        envelope_id: "env-domain-1",
        event_id: "evt-domain-2",
      },
      null,
    );
    const after = await store.getLeadById(lead.id);
    expect(after?.fdd_status).toBe("waiting_period_active");
    const workflowAfter = await store.getFddWorkflowByOpportunityId(opportunity!.id);
    expect(workflowAfter?.status).toBe("waiting_period_active");
    expect(workflowAfter?.delivered_at).not.toBeNull();
  });
});

describe("external record mappings", () => {
  it("rejects conflicting mappings in the same provider scope, allows across providers", async () => {
    const org = await resolveDefaultOrganization();
    const leadA = await createLead();
    const leadB = await createLead();
    const chainA = await ensureLeadDomainChain(leadA);
    const chainB = await ensureLeadDomainChain(leadB);

    const mapping = await store.upsertExternalMapping({
      organization_id: org.id,
      provider: "gohighlevel",
      entity_type: "client",
      internal_entity_id: chainA.client.id,
      external_id: "ghl-contact-1",
    });
    expect(mapping.internal_entity_id).toBe(chainA.client.id);

    // Same external ID re-upserted: resolves to one row (last write wins on
    // the same key, no duplicates).
    const again = await store.upsertExternalMapping({
      organization_id: org.id,
      provider: "gohighlevel",
      entity_type: "client",
      internal_entity_id: chainA.client.id,
      external_id: "ghl-contact-1",
    });
    expect(again.id).toBe(mapping.id);

    // A second mapping for the same internal entity in the same scope is a
    // conflict.
    await expect(
      store.upsertExternalMapping({
        organization_id: org.id,
        provider: "gohighlevel",
        entity_type: "client",
        internal_entity_id: chainA.client.id,
        external_id: "ghl-contact-other",
      }),
    ).rejects.toThrow(/already exists/);

    // Different provider may reuse the same raw external ID.
    const facebook = await store.upsertExternalMapping({
      organization_id: org.id,
      provider: "facebook",
      entity_type: "client",
      internal_entity_id: chainB.client.id,
      external_id: "ghl-contact-1",
    });
    expect(facebook.internal_entity_id).toBe(chainB.client.id);

    // Resolution returns the correct internal entity per scope.
    const resolved = await store.getExternalMapping(
      org.id,
      "gohighlevel",
      "client",
      "ghl-contact-1",
    );
    expect(resolved?.internal_entity_id).toBe(chainA.client.id);
  });
});

describe("centralized activity service", () => {
  it("attaches events to org, client, lead, and opportunity, and dedupes external IDs", async () => {
    const lead = await createLead();
    const chain = await ensureLeadDomainChain(lead);

    await recordLeadEvent(chain.lead, "custom_event", { n: 1 }, null, {
      source: "webhook_calendar",
      externalEventId: "ext-1",
      occurredAt: "2026-01-01T00:00:00.000Z",
    });
    await recordLeadEvent(chain.lead, "custom_event", { n: 2 }, null, {
      source: "webhook_calendar",
      externalEventId: "ext-1", // duplicate — must be dropped
    });
    await recordLeadEvent(chain.lead, "later_event", null, null, {
      source: "portal",
      occurredAt: "2026-01-02T00:00:00.000Z",
    });

    const timeline = await store.listActivityForOpportunity(chain.opportunity.id);
    const custom = timeline.filter((e) => e.event_type === "custom_event");
    expect(custom).toHaveLength(1);
    expect(custom[0].organization_id).toBe(chain.organization.id);
    expect(custom[0].client_id).toBe(chain.client.id);
    expect(custom[0].lead_id).toBe(chain.lead.id);

    // Newest first by occurred_at.
    const ordered = timeline.filter((e) =>
      ["custom_event", "later_event"].includes(e.event_type),
    );
    expect(ordered[0].event_type).toBe("later_event");

    // Legacy portal_events still written (dual-write, single service).
    const legacy = await store.getEventsForLead(lead.id);
    expect(legacy.filter((e) => e.event_name === "custom_event")).toHaveLength(2);
  });
});

describe("portal context compatibility", () => {
  it("resolves an existing token to the full domain context without changing it", async () => {
    const lead = await createLead();
    const token = lead.portal_token;

    const context = await loadPortalContext(token, { trackOpen: false });
    expect(context).not.toBeNull();
    expect(context!.lead.portal_token).toBe(token); // token unchanged
    expect(context!.organization?.slug).toBe("gendev");
    expect(context!.client?.source_lead_id).toBe(lead.id);
    expect(context!.opportunity?.source_lead_id).toBe(lead.id);
    expect(context!.brand?.slug).toBe("default");
  });

  it("repairs a missing chain on load (pre-backfill lead)", async () => {
    const lead = await createLead();
    expect(lead.client_id).toBeNull();
    const context = await loadPortalContext(lead.portal_token, { trackOpen: false });
    expect(context!.client).not.toBeNull();
    const reloaded = await store.getLeadById(lead.id);
    expect(reloaded?.client_id).toBe(context!.client!.id);
    expect(reloaded?.primary_opportunity_id).toBe(context!.opportunity!.id);
  });
});

describe("stage service synchronization", () => {
  it("projects manual stage changes onto the primary opportunity", async () => {
    const staff = await createStaff("ADVISOR");
    const lead = await createLead();
    const chain = await ensureLeadDomainChain(lead);

    await setStageManually(chain.lead, "DUE_DILIGENCE", staff.id);
    const opportunity = await store.getOpportunityById(chain.opportunity.id);
    expect(opportunity?.stage).toBe("DUE_DILIGENCE");
    const reloaded = await store.getLeadById(lead.id);
    expect(reloaded?.current_stage).toBe("DUE_DILIGENCE");
  });
});
