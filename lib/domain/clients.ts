import { getStore } from "@/lib/store";
import type { ClientPatch, ClientRecord, CreateClientInput } from "@/types/domain";
import type { LeadRecord } from "@/types/lead";

/**
 * Client service. A client is the canonical person record within an
 * organization. Duplicate detection SUGGESTS matches — it never merges.
 */

export async function createClient(input: CreateClientInput): Promise<ClientRecord> {
  return getStore().createClient(input);
}

export async function getClientInOrganization(
  organizationId: string,
  clientId: string,
): Promise<ClientRecord | null> {
  const client = await getStore().getClientById(clientId);
  if (!client || client.organization_id !== organizationId) return null;
  return client;
}

export async function updateClient(id: string, patch: ClientPatch): Promise<ClientRecord> {
  return getStore().updateClient(id, patch);
}

/** The client a lead resolves to, or null before the chain is built. */
export async function resolveClientFromLead(lead: LeadRecord): Promise<ClientRecord | null> {
  const store = getStore();
  if (lead.client_id) {
    const byId = await store.getClientById(lead.client_id);
    if (byId) return byId;
  }
  return store.getClientBySourceLeadId(lead.id);
}

/**
 * Possible duplicate candidates for a person within one organization.
 * Email is a matching aid, not an identity — candidates are surfaced for
 * human reconciliation and NEVER auto-merged (emails can be shared,
 * mistyped, or reused).
 */
export async function findDuplicateCandidates(
  organizationId: string,
  probe: { email?: string | null },
  excludeClientId?: string,
): Promise<ClientRecord[]> {
  if (!probe.email) return [];
  const matches = await getStore().findClientsByEmail(organizationId, probe.email);
  return matches.filter((c) => c.id !== excludeClientId);
}
