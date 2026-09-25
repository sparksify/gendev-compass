import { beforeEach, describe, expect, it, vi } from "vitest";
import { answerSnapshot, type KnownLeadAssessmentInput } from "@/lib/bridge/assessment";
import { projectIntelligence, questionnaireNotes, type IntelligenceSource } from "@/lib/ghl/intelligence/project";
import { verifiedWatch } from "@/lib/portal/verifiedWatch";
import { selectExactContact, GhlClient } from "@/lib/ghl/intelligence/client";
import { INTELLIGENCE_FIELDS, ANSWERS_FIELD } from "@/lib/ghl/intelligence/fields";
import type { IntelligenceState } from "@/lib/ghl/intelligence/types";

const mocks = vi.hoisted(() => ({ store: {} as Record<string, unknown>, upload: vi.fn() }));
vi.mock("@/lib/store", () => ({ getStore: () => mocks.store }));
vi.mock("@/lib/ghl/questionnaireUpload", () => ({ uploadQuestionnairePdfToGhl: mocks.upload }));
import { syncIntelligence, runIntelligenceSync } from "@/lib/ghl/intelligence/sync";

const time = "2026-09-24T12:00:00.000Z";
const input = { goal: "replace-income", role: "lead-team", timeline: "within-3-months", city: "Austin", state: "TX", zip: "78701", investmentLevel: "125k-200k", liquidCapital: "250k-499k", priority: "territory", notes: "My actual optional note <script>" } as KnownLeadAssessmentInput;
function source(): IntelligenceSource {
  return { lead: { id: "lead-1", email: "prospect@example.test", created_at: time, qualification_result: null } as IntelligenceSource["lead"],
    video: null, questionnaire: null, submissions: [], appointments: [],
    events: [{ id: "event-1", lead_id: "lead-1", event_name: "bridge_assessment_submitted", created_at: time, page_url: "/watch", event_source: "portal", created_by_staff_user_id: null, occurred_at: null,
      event_data: { version: "bridge-fit-v1", fit: "strong", answers: answerSnapshot(input) } } as IntelligenceSource["events"][number]] };
}
function video(percent = 30): IntelligenceSource["video"] {
  return { id:"watch-1", lead_id:"lead-1", wistia_media_id:"th7ve390tt", last_playhead_position:200, started:true, completed:false, play_count:1, first_played_at:time, last_event_at:time, created_at:time, updated_at:time, organization_id:null, client_id:null, opportunity_id:null, brand_id:null, highest_percent_watched: 100, accumulated_seconds_watched: 999,
    verified_watch: { th7ve390tt: { percent, seconds: percent * 2, duration: 200, at: time } } } as IntelligenceSource["video"];
}
function questionnaire(s: IntelligenceSource) {
  s.questionnaire = { investment_timeline: "within-90-days", liquid_capital: "250k-499k" } as IntelligenceSource["questionnaire"];
  s.submissions = [{ id: "submission-1", questionnaire_version: "1.1", submitted_at: time,
    answers: Array.from({ length: 24 }, (_, i) => ({ question_key: String(i), question_text: `Actual question ${i}?`, answer_display_value: `Actual answer ${i}: ${"long response ".repeat(80)}` })) } as IntelligenceSource["submissions"][number]];
}
function booking(s: IntelligenceSource) {
  s.appointments = [{ status: "SCHEDULED", scheduled_start: "2099-01-01T12:00:00Z", scheduled_end: "2099-01-01T13:00:00Z", updated_at: time } as IntelligenceSource["appointments"][number]];
}

describe("Compass signal projection", () => {
  it("follows up an assessment without any video; fit is separate from intent", () => {
    const p = projectIntelligence(source());
    expect(p.rank).toBe(2); expect(p.taskLevel).toBe(1);
    expect(p.fields["contact.compass_next_action"]).toBe("Follow up");
    expect(p.fields["contact.compass_qualification_summary"]).toContain("Strong");
    for (const a of answerSnapshot(input)) expect(p.bridgeText).toContain(`${a.question}\n${a.label}`);
    expect(p.bridgeText).toContain("bridge-fit-v1"); expect(p.bridgeText).toContain(time);
  });
  it("requires unique watch >=30% and never derives it from legacy progress or seeking", () => {
    expect(verifiedWatch(1,200)).toBe(0.5);
    expect(verifiedWatch(undefined,200)).toBeNull(); expect(verifiedWatch(300,200)).toBeNull();
    const s = source(); s.video = { highest_percent_watched: 100, accumulated_seconds_watched: 1000 } as IntelligenceSource["video"];
    expect(projectIntelligence(s).rank).toBe(2);
    s.video = video(29.99); expect(projectIntelligence(s).rank).toBe(2);
    s.video = video(30); expect(projectIntelligence(s).rank).toBe(3);
    expect(projectIntelligence(s).taskTitle).toBe("CALL NOW — Bridge assessment + overview engagement");
  });
  it("video alone does not create a call task and anonymous visits are not counted", () => {
    const s = source(); s.events = []; s.video = video(99);
    expect(projectIntelligence(s).taskLevel).toBe(0);
    expect(projectIntelligence(s).rank).toBe(1);
    expect(JSON.stringify(projectIntelligence(s))).not.toContain("visits");
  });
  it("keeps all longer questionnaire answers accessible and labels distinct completion", () => {
    const s = source(); questionnaire(s);
    const p = projectIntelligence(s); expect(p.rank).toBe(4); expect(p.taskLevel).toBe(3);
    const notes = questionnaireNotes(s.submissions[0]).join("\n");
    for (const a of s.submissions[0].answers) expect(notes).toContain(`${a.question_text}\n${a.answer_display_value}`);
    expect(p.fields["contact.compass_investor_questionnaire"]).toContain("pending verification");
    expect(projectIntelligence(source(),4).rank).toBe(4);
  });
  it("does not call a snapshot-only partial save a completed questionnaire", () => {
    const s = source(); questionnaire(s); s.questionnaire = null;
    const p = projectIntelligence(s);
    expect(p.submission).toBeUndefined(); expect(p.rank).toBe(2);
    expect(p.fields["contact.compass_investor_questionnaire"]).toBe("Not submitted");
  });
  it("suppresses a booked lead without regressing engagement", () => {
    const s = source(); s.video = video(); booking(s);
    const p = projectIntelligence(s); expect(p.booked).toBe(true); expect(p.rank).toBe(3);
    expect(p.fields["contact.compass_next_action"]).toBe("Appointment booked");
  });
});
describe("contact selection", () => {
  const contact = { id: "crm-1", email: "Prospect@Example.test", locationId: "loc" };
  it("requires exact email and location", () => {
    expect(selectExactContact([contact], "prospect@example.test", "loc").id).toBe("crm-1");
    expect(() => selectExactContact([contact], "prospect@example.test", "other")).toThrow();
    expect(() => selectExactContact([contact], "spect@example.test", "loc")).toThrow();
  });
  it("rejects duplicates and incomplete search results", () => {
    expect(() => selectExactContact([contact,{...contact,id:"other"}],contact.email,"loc")).toThrow(/Duplicate/);
    expect(() => selectExactContact([contact],contact.email,"loc",2)).toThrow(/Duplicate/);
  });
});

function harness(s = source()) {
  let serial = 0;
  const claim: IntelligenceState = { lead_id: "lead-1", event_key: "event-1", revision: 1, synced_revision: 0, attempts: 1,
    last_error: null, next_attempt_at: time, lease_token: "lease", lease_until: time, external: {} };
  const notes: Array<{ id: string; body: string }> = [];
  const tasks: Array<{ id: string; title: string; body: string; completed: boolean }> = [];
  const writes: Array<{ path: string; method: string; body: Record<string, unknown> }> = [];
  let loseNoteReply = false;
  Object.assign(mocks.store, {
    getLeadById: vi.fn(async () => s.lead), getEventsForLead: vi.fn(async () => s.events), getVideoProgress: vi.fn(async () => s.video),
    getQuestionnaire: vi.fn(async () => s.questionnaire), getSubmissionsForLead: vi.fn(async () => s.submissions), getAppointmentsForLead: vi.fn(async () => s.appointments),
    checkpointIntelligence: vi.fn(async (_: unknown, external: IntelligenceState["external"]) => { claim.external = structuredClone(external); }),
  });
  const resolvedContact = () => ({ id:"crm-1", email:"prospect@example.test", locationId:"loc", assignedTo:"owner", customFields: claim.external.pdfSubmissionId ? [{id:"pdf",value:`compass-questionnaire-${claim.external.pdfSubmissionId}.pdf`}] : [] });
  const client = { locationId: "loc", resolveContact: vi.fn(async () => resolvedContact()), contact: vi.fn(async () => resolvedContact()),
    request: vi.fn(async (path: string, method = "GET", body: Record<string, unknown> = {}) => {
      if (method !== "GET") writes.push({path, method, body});
      if (path.includes("customFields?")) return { customFields: [...INTELLIGENCE_FIELDS, ANSWERS_FIELD].map(f => ({id:f.key, fieldKey:f.key, dataType:f.type})) };
      if (path.startsWith("/users/")) return {users:[{id:"owner"}]};
      if (path.endsWith("/notes") && method === "GET") return {notes:structuredClone(notes)};
      if (path.endsWith("/tasks") && method === "GET") return {tasks:structuredClone(tasks)};
      if (path.endsWith("/notes") && method === "POST") {
        const note = {id:`note-${++serial}`,body:String(body.body)}; notes.push(note);
        if (loseNoteReply) { loseNoteReply = false; throw new Error("Lost response"); }
        return {note};
      }
      if (path.endsWith("/tasks") && method === "POST") { const task = {id:`task-${++serial}`, ...body} as typeof tasks[number]; tasks.push(task); return {task}; }
      if (path.includes("/tasks/") && method === "PUT") Object.assign(tasks.find(t=>path.endsWith(t.id))!,body);
      if (path.includes("/notes/") && method === "PUT") Object.assign(notes.find(n=>path.endsWith(n.id))!,body);
      return {};
    }) } as unknown as GhlClient;
  return {claim,client,notes,tasks,writes,source:s,loseNoteReply:()=>{loseNoteReply=true;}};
}
beforeEach(() => { mocks.upload.mockReset(); mocks.upload.mockResolvedValue({ok:true,contactId:"crm-1",fieldId:"pdf"}); });
describe("CRM worker replay and recovery", () => {
  it("reuses the durable contact binding on retries instead of repeating an ambiguous search", async () => {
    const h = harness();
    await syncIntelligence(h.claim,h.client);
    await syncIntelligence(h.claim,h.client);
    expect(h.client.resolveContact).toHaveBeenCalledTimes(1);
    expect(h.client.contact).toHaveBeenCalledWith("crm-1");
  });
  it("fails closed when a durable contact binding no longer matches the lead", async () => {
    const h = harness();
    h.claim.external = { contactId:"crm-1", locationId:"loc" };
    vi.mocked(h.client.contact).mockResolvedValueOnce({ id:"crm-1", email:"someone-else@example.test", locationId:"loc" });
    await expect(syncIntelligence(h.claim,h.client)).rejects.toThrow("email no longer matches");
    expect(h.writes).toHaveLength(0);
  });
  it("creates one assessment-only follow-up, upgrades it, and preserves other tags and fields", async () => {
    const h = harness(); await syncIntelligence(h.claim,h.client); await syncIntelligence(h.claim,h.client);
    expect(h.tasks).toHaveLength(1); expect(h.notes).toHaveLength(1);
    expect(h.tasks[0].title).toContain("Follow up");
    h.source.video=video(); await syncIntelligence(h.claim,h.client);
    expect(h.tasks).toHaveLength(1); expect(h.tasks[0].title).toContain("CALL NOW");
    expect(h.writes.filter(w=>w.path==="/contacts/crm-1").every(w=>Object.keys(w.body).join()==="customFields")).toBe(true);
    expect(h.writes.some(w=>w.path.includes("opportunities"))).toBe(false);
    expect(h.notes[0].body).toContain("&lt;script&gt;");
    h.tasks[0].completed=true; await syncIntelligence(h.claim,h.client); expect(h.tasks[0].completed).toBe(true);
  });
  it("reconciles a successful note POST whose reply was lost without duplicate creation", async () => {
    const h=harness(); h.loseNoteReply(); await expect(syncIntelligence(h.claim,h.client)).rejects.toThrow("Lost response");
    await syncIntelligence(h.claim,h.client); expect(h.notes).toHaveLength(1); expect(h.tasks).toHaveLength(1);
  });
  it("books without new task and closes the integration task if booking arrives later", async () => {
    const h=harness(); booking(h.source); await syncIntelligence(h.claim,h.client); expect(h.tasks).toHaveLength(0);
    h.source.appointments=[]; await syncIntelligence(h.claim,h.client); expect(h.tasks).toHaveLength(1);
    booking(h.source); await syncIntelligence(h.claim,h.client); expect(h.tasks[0].completed).toBe(true);
  });
  it("publishes every questionnaire answer despite PDF failure, marks pending, then retries the PDF", async () => {
    const h=harness(); questionnaire(h.source); mocks.upload.mockResolvedValueOnce({ok:false,error:"HTTP 503"});
    await expect(syncIntelligence(h.claim,h.client)).rejects.toThrow("HTTP 503");
    const archive=h.notes.map(n=>n.body).join(); for(const a of h.source.submissions[0].answers) expect(archive).toContain(a.answer_display_value);
    expect(JSON.stringify(h.writes.at(-1))).toContain("pending / retrying");
    const count=h.notes.length; await syncIntelligence(h.claim,h.client);
    expect(h.notes).toHaveLength(count); expect(h.tasks).toHaveLength(1); expect(h.claim.external.pdfSubmissionId).toBe("submission-1");
    await syncIntelligence(h.claim,h.client); expect(mocks.upload).toHaveBeenCalledTimes(2);
  });
  it("records failures and returns them to the durable retry queue", async () => {
    vi.stubEnv("GHL_COMPASS_ENABLED","true"); vi.stubEnv("GHL_API_TOKEN","");
    const h=harness(); const finish=vi.fn(); mocks.store.claimIntelligence=vi.fn().mockResolvedValueOnce(h.claim).mockResolvedValue(null); mocks.store.finishIntelligence=finish;
    const result=await runIntelligenceSync(); expect(result.failed).toBe(1); expect(finish).toHaveBeenCalledWith(h.claim,expect.stringContaining("not configured"));
    vi.unstubAllEnvs();
  });
});

describe("assessment durability boundary", () => {
  it("does not acknowledge success or emit coarse analytics when the required answer write fails", async () => {
    const { applyAssessmentToLead } = await import("@/lib/bridge/lead");
    const s=source();
    mocks.store.updateLead=vi.fn(async()=>s.lead);
    const insert=vi.fn().mockRejectedValue(new Error("answer store unavailable"));
    mocks.store.insertEvent=insert;
    await expect(applyAssessmentToLead(s.lead,input)).rejects.toThrow("answer store unavailable");
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert.mock.calls[0][1]).toBe("bridge_assessment_submitted");
    expect(insert.mock.calls[0][4]).toMatchObject({strict:true,eventKey:expect.stringMatching(/^bridge:/)});
  });
});
