/**
 * Integration tests against the file-backed dev store (same PortalStore
 * interface as Supabase). The working directory is switched to a temp dir
 * before the store modules load so .dev-data lands there.
 */
import { mkdtempSync, rmSync } from "fs";
import os from "os";
import path from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PortalStore } from "@/lib/store/types";
import type { LeadRecord } from "@/types/lead";

const tmpDir = mkdtempSync(path.join(os.tmpdir(), "advisor-store-test-"));
const originalCwd = process.cwd();

let store: PortalStore;
let autoAdvanceStage: typeof import("@/lib/advisor/stages").autoAdvanceStage;
let setStageManually: typeof import("@/lib/advisor/stages").setStageManually;
let applyVideoProgress: typeof import("@/lib/portal/progress").applyVideoProgress;
let buildAnswerSnapshot: typeof import("@/lib/advisor/questionnaireCatalog").buildAnswerSnapshot;
let createSession: typeof import("@/lib/advisor/auth").createSession;
let hashSessionToken: typeof import("@/lib/advisor/auth").hashSessionToken;
let applyFddProviderEvent: typeof import("@/lib/fdd/workflow").applyFddProviderEvent;

beforeAll(async () => {
  process.chdir(tmpDir);
  // Import after chdir so the dev store binds its data dir to the temp dir.
  const storeModule = await import("@/lib/store");
  store = storeModule.getStore();
  ({ autoAdvanceStage, setStageManually } = await import("@/lib/advisor/stages"));
  ({ applyVideoProgress } = await import("@/lib/portal/progress"));
  ({ buildAnswerSnapshot } = await import("@/lib/advisor/questionnaireCatalog"));
  ({ createSession, hashSessionToken } = await import("@/lib/advisor/auth"));
  ({ applyFddProviderEvent } = await import("@/lib/fdd/workflow"));
});

afterAll(() => {
  process.chdir(originalCwd);
  rmSync(tmpDir, { recursive: true, force: true });
});

let tokenCounter = 0;
async function createLead(): Promise<LeadRecord> {
  tokenCounter += 1;
  return store.createLead({
    portal_token: `test-token-${tokenCounter}-0123456789abcdef`,
    first_name: "Test",
    last_name: `Lead${tokenCounter}`,
    email: `lead${tokenCounter}@example.test`,
    phone: null,
    state: null,
    source: null,
    campaign: null,
    ad_set: null,
    ad: null,
    facebook_lead_id: null,
    initial_liquid_capital: null,
    initial_net_worth: null,
    initial_business_owner: null,
  });
}

describe("automatic stage advancement", () => {
  it("advances forward and records a stage_changed event", async () => {
    const lead = await createLead();
    await autoAdvanceStage(lead, "QUESTIONNAIRE_COMPLETED", "portal");

    const updated = await store.getLeadById(lead.id);
    expect(updated?.current_stage).toBe("QUESTIONNAIRE_COMPLETED");

    const events = await store.getEventsForLead(lead.id);
    const stageEvents = events.filter((e) => e.event_name === "stage_changed");
    expect(stageEvents).toHaveLength(1);
    expect(stageEvents[0].event_data).toMatchObject({
      oldStage: "NEW_LEAD",
      newStage: "QUESTIONNAIRE_COMPLETED",
      automatic: true,
    });
  });

  it("never moves an investor backward automatically", async () => {
    const lead = await createLead();
    await autoAdvanceStage(lead, "CONSULTATION_SCHEDULED", "portal");
    await autoAdvanceStage(lead, "PORTAL_ACTIVE", "portal");

    const updated = await store.getLeadById(lead.id);
    expect(updated?.current_stage).toBe("CONSULTATION_SCHEDULED");
  });

  it("does not override manual judgment stages", async () => {
    const lead = await createLead();
    await setStageManually(lead, "NOT_A_FIT", "staff-user-1");
    const parked = await store.getLeadById(lead.id);
    await autoAdvanceStage(parked!, "CONSULTATION_SCHEDULED", "portal");

    const updated = await store.getLeadById(lead.id);
    expect(updated?.current_stage).toBe("NOT_A_FIT");
  });

  it("allows manual moves in any direction with audit trail", async () => {
    const lead = await createLead();
    await autoAdvanceStage(lead, "FDD_SENT", "portal");
    const current = await store.getLeadById(lead.id);
    await setStageManually(current!, "ENGAGED", "staff-user-1");

    const updated = await store.getLeadById(lead.id);
    expect(updated?.current_stage).toBe("ENGAGED");

    const events = await store.getEventsForLead(lead.id);
    const manual = events.find(
      (e) => e.event_name === "stage_changed" && e.event_data?.automatic === false,
    );
    expect(manual?.created_by_staff_user_id).toBe("staff-user-1");
  });
});

describe("questionnaire persistence", () => {
  it("stores a versioned submission with full question text", async () => {
    const lead = await createLead();
    const answers = buildAnswerSnapshot({
      investmentTimeline: "within-30-days",
      liquidCapital: "250k-499k",
      netWorth: "1m-2.4m",
      businessOwnership: "yes-currently",
      primaryInterest: "Territory availability",
      remainingQuestions: "Onboarding process",
      decisionCriteria: "Unit economics",
      decisionParticipants: "spouse",
      accuracyConfirmed: true,
    });

    await store.createSubmission({
      lead_id: lead.id,
      questionnaire_version: "1.0",
      submitted_at: new Date().toISOString(),
      answers,
    });

    const submissions = await store.getSubmissionsForLead(lead.id);
    expect(submissions).toHaveLength(1);
    expect(submissions[0].questionnaire_version).toBe("1.0");
    expect(submissions[0].answers).toHaveLength(9);

    const liquid = submissions[0].answers.find((a) => a.question_key === "liquidCapital");
    expect(liquid?.question_text).toMatch(/liquid capital/i);
    expect(liquid?.answer_value).toBe("250k-499k");
    expect(liquid?.answer_display_value).toBe("$250,000–$499,999");
  });
});

describe("video milestone deduplication", () => {
  it("fires each milestone exactly once across repeated reports", async () => {
    const lead = await createLead();
    const base = { duration: 100, eventType: "timeupdate" as const, mediaId: "abc" };

    await applyVideoProgress(lead, { ...base, currentTime: 30, percent: 30 });
    const after1 = await store.getLeadById(lead.id);
    await applyVideoProgress(after1!, { ...base, currentTime: 30, percent: 30 });
    await applyVideoProgress(after1!, { ...base, currentTime: 28, percent: 28 });

    const events = await store.getEventsForLead(lead.id);
    expect(events.filter((e) => e.event_name === "video_progress_25")).toHaveLength(1);
    expect(events.filter((e) => e.event_name === "video_progress_50")).toHaveLength(0);
  });

  it("advances the stage to ENGAGED on first play and counts plays", async () => {
    const lead = await createLead();
    await applyVideoProgress(lead, {
      currentTime: 0,
      duration: 100,
      percent: 0,
      eventType: "play",
      mediaId: "abc",
    });

    const updated = await store.getLeadById(lead.id);
    expect(updated?.current_stage).toBe("ENGAGED");

    const progress = await store.getVideoProgress(lead.id);
    expect(progress?.play_count).toBe(1);
    expect(progress?.first_played_at).toBeTruthy();
  });
});

describe("staff sessions", () => {
  it("stores only the token hash and resolves sessions", async () => {
    const user = await store.createStaffUser({
      first_name: "Session",
      last_name: "Tester",
      email: "session-tester@example.test",
      password_hash: "scrypt$x",
      role: "ADVISOR",
    });

    const { token, expiresAt } = await createSession(user.id);
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());

    const session = await store.getStaffSessionByHash(hashSessionToken(token));
    expect(session?.staff_user_id).toBe(user.id);
    expect(session?.token_hash).not.toBe(token);

    // Raw token is never stored.
    expect(await store.getStaffSessionByHash(token)).toBeNull();

    await store.deleteStaffSession(hashSessionToken(token));
    expect(await store.getStaffSessionByHash(hashSessionToken(token))).toBeNull();
  });
});

describe("FDD provider webhook handling", () => {
  it("advances fdd_status forward and mirrors the advisor pipeline stage on send", async () => {
    const lead = await createLead();
    const result = await applyFddProviderEvent(
      { event: "fdd_sent", prospect_id: lead.id, event_id: `evt-${lead.id}-sent` },
      "127.0.0.1",
    );
    expect(result.ok).toBe(true);
    expect(result.duplicate).toBe(false);

    const updated = await store.getLeadById(lead.id);
    expect(updated?.fdd_status).toBe("fdd_sent");
    expect(updated?.fdd_sent_at).toBeTruthy();
    expect(updated?.current_stage).toBe("FDD_SENT");

    const audit = await store.listFddAudit(lead.id);
    expect(audit.some((a) => a.event === "fdd_sent")).toBe(true);
  });

  it("starts the waiting period and advances the stage on receipt", async () => {
    const lead = await createLead();
    await applyFddProviderEvent(
      { event: "fdd_sent", prospect_id: lead.id, event_id: `evt-${lead.id}-sent` },
      null,
    );
    const result = await applyFddProviderEvent(
      { event: "fdd_received", prospect_id: lead.id, event_id: `evt-${lead.id}-received` },
      null,
    );
    expect(result.ok).toBe(true);

    const updated = await store.getLeadById(lead.id);
    expect(updated?.fdd_status).toBe("waiting_period_active");
    expect(updated?.fdd_received_at).toBeTruthy();
    expect(updated?.fdd_eligible_at).toBeTruthy();
    expect(updated?.current_stage).toBe("FDD_ACKNOWLEDGED");
  });

  it("deduplicates a replayed webhook event", async () => {
    const lead = await createLead();
    const eventId = `evt-${lead.id}-dup`;
    await applyFddProviderEvent({ event: "fdd_sent", prospect_id: lead.id, event_id: eventId }, null);
    const replay = await applyFddProviderEvent(
      { event: "fdd_sent", prospect_id: lead.id, event_id: eventId },
      null,
    );
    expect(replay.duplicate).toBe(true);

    const audit = await store.listFddAudit(lead.id);
    expect(audit.filter((a) => a.external_event_id === eventId)).toHaveLength(1);
  });

  it("never regresses a manually parked stage on a late FDD event", async () => {
    const lead = await createLead();
    await setStageManually(lead, "NOT_A_FIT", "staff-user-1");
    const parked = await store.getLeadById(lead.id);
    await applyFddProviderEvent(
      { event: "fdd_sent", prospect_id: parked!.id, event_id: `evt-${lead.id}-late` },
      null,
    );

    const updated = await store.getLeadById(lead.id);
    expect(updated?.current_stage).toBe("NOT_A_FIT");
  });
});
