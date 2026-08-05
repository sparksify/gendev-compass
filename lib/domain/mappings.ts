import { getStore } from "@/lib/store";
import type {
  ExternalEntityType,
  ExternalProvider,
  ExternalRecordMappingRecord,
  UpsertExternalMappingInput,
} from "@/types/domain";

/**
 * External record mapping service — the integrity layer for provider IDs.
 * External IDs (GoHighLevel contacts, Facebook leads, document envelopes)
 * are never internal keys; this service resolves them to internal UUIDs.
 *
 * Uniqueness (enforced by the store/schema): one external ID maps to exactly
 * one internal entity per organization + provider + entity type, and one
 * internal entity has at most one mapping per that same scope. Different
 * providers may reuse the same raw external ID without conflict.
 *
 * Legacy columns (leads.facebook_lead_id, leads.fdd_provider_envelope_id,
 * appointments.external_appointment_id, …) remain readable during the
 * transition; new integrations should register mappings here as well.
 */

export async function upsertMapping(
  input: UpsertExternalMappingInput,
): Promise<ExternalRecordMappingRecord> {
  return getStore().upsertExternalMapping(input);
}

/** Resolves the internal entity ID for a provider record, or null. */
export async function findInternalEntityId(
  organizationId: string,
  provider: ExternalProvider,
  entityType: ExternalEntityType,
  externalId: string,
): Promise<string | null> {
  const mapping = await getStore().getExternalMapping(
    organizationId,
    provider,
    entityType,
    externalId,
  );
  return mapping?.internal_entity_id ?? null;
}

export async function listMappingsForEntity(
  internalEntityId: string,
): Promise<ExternalRecordMappingRecord[]> {
  return getStore().listMappingsForEntity(internalEntityId);
}

/** Records a successful sync without changing the mapping itself. */
export async function touchMapping(input: UpsertExternalMappingInput): Promise<void> {
  await getStore().upsertExternalMapping(input);
}
