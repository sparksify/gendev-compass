import { mkdtempSync, rmSync } from "fs";
import os from "os";
import path from "path";
import { afterAll, beforeAll, expect, it } from "vitest";
import type { PortalStore } from "@/lib/store/types";
import type { LeadRecord } from "@/types/lead";
const cwd=process.cwd(); const temp=mkdtempSync(path.join(os.tmpdir(),"compass-outbox-"));
let store:PortalStore; let lead:LeadRecord;
beforeAll(async()=>{
  process.chdir(temp); store=(await import("@/lib/store")).getStore();
  lead=await store.createLead({bridge_submission_key:"anonymous-retry-key",portal_token:"intelligence-test-token-0123456789",first_name:"Test",last_name:"Prospect",email:"test@example.test",phone:null,source:"bridge",campaign:null,ad_set:null,ad:null,facebook_lead_id:null,initial_liquid_capital:null,initial_net_worth:null,initial_business_owner:null});
});
afterAll(()=>{process.chdir(cwd);rmSync(temp,{recursive:true,force:true});});
it("replayed anonymous intake keeps the same lead and portal token",async()=>{
  const same=await store.createLead({...lead,portal_token:"a-different-token",bridge_submission_key:"anonymous-retry-key"});
  expect(same.id).toBe(lead.id);expect(same.portal_token).toBe(lead.portal_token);
});
it("strict answer event deduplicates and queues durably; claims are exclusive",async()=>{
  await Promise.all([1,2,3].map(()=>store.insertEvent(lead.id,"bridge_assessment_submitted",{version:"v1",answers:[]},"/watch",{eventKey:"assessment-1",strict:true})));
  expect((await store.getEventsForLead(lead.id)).filter(e=>e.event_name==="bridge_assessment_submitted")).toHaveLength(1);
  const claims=await Promise.all([store.claimIntelligence(),store.claimIntelligence()]);
  expect(claims.filter(Boolean)).toHaveLength(1); const claim=claims.find(c=>c)!;
  await store.checkpointIntelligence(claim,{contactId:"crm-1",taskId:"task-1"});
  // New source work while leased must survive acknowledgment of the old claim.
  await store.insertEvent(lead.id,"bridge_assessment_submitted",{version:"v1",answers:[]},"/watch",{eventKey:"assessment-2",strict:true});
  await store.finishIntelligence(claim);
  const next=await store.claimIntelligence();expect(next!.revision).toBeGreaterThan(claim.revision);
  expect(next!.external.taskId).toBe("task-1");await store.finishIntelligence(next!);
  expect(await store.claimIntelligence()).toBeNull();
});
it("failed work retains its retry count, error, and external IDs",async()=>{
  await store.insertEvent(lead.id,"bridge_assessment_submitted",{answers:[]},"/watch",{eventKey:"assessment-3",strict:true});
  const claim=(await store.claimIntelligence())!;expect(claim.attempts).toBeGreaterThan(1);
  await store.finishIntelligence(claim,"HighLevel HTTP 503");expect(await store.claimIntelligence()).toBeNull();
  const {readFileSync}=await import("fs");const disk=JSON.parse(readFileSync(path.join(temp,".dev-data/store.json"),"utf8"));
  const row=disk.compass_intelligence_sync[0];expect(row.last_error).toBe("HighLevel HTTP 503");expect(row.external.taskId).toBe("task-1");expect(row.revision).toBeGreaterThan(row.synced_revision);
});
