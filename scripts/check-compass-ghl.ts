/** Read-only API preflight. Run in a trusted environment with the existing
 * server credentials injected; no token values or contact answers are logged. */
import { GhlClient } from "../lib/ghl/intelligence/client";
import { getIntelligenceFields } from "../lib/ghl/intelligence/fields";
async function main() {
  const client = new GhlClient();
  const fields = await getIntelligenceFields(client);
  const users = await client.request<{ users: Array<{ id: string; name?: string; firstName?: string; lastName?: string }> }>(`/users/?locationId=${client.locationId}`);
  console.log(JSON.stringify({locationId:client.locationId, fields:[...fields.values()], darkoCandidates:users.users.filter(u=>/darko/i.test([u.name,u.firstName,u.lastName].join(" ")))},null,2));
  const pdf = await client.request<{ customFields: Array<{fieldKey:string;dataType:string;id:string}> }>(`/locations/${client.locationId}/customFields?model=contact`);
  console.log("CQ Upload:",pdf.customFields.filter(f=>f.fieldKey==="contact.cq_upload"));
  console.log("Read scopes confirmed. Task/note/tag writes and PDF open still require the live contact check.");
}
main().catch(error=>{console.error(error instanceof Error?error.message:"Preflight failed");process.exitCode=1;});
