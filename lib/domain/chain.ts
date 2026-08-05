import { getStore } from "@/lib/store";
import { resolveDefaultOrganization } from "@/lib/domain/organizations";
import { resolveDefaultBrand } from "@/lib/domain/brands";
import { syncFddWorkflowFromLead } from "@/lib/domain/fddWorkflows";
import type { LeadRecord } from "@/types/lead";
import type {
  BrandRecord,
  ClientRecord,
  OpportunityRecord,
  OrganizationRecord,
} from "@/types/domain";

/**
 * Lead domain chain: lead → organization / brand / client / opportunity.
 *
 * The single get-or-create path used by lead intake, the portal context
 * loader, and the FDD service. Deterministic and idempotent — provenance
 * keys (clients.source_lead_id, opportunities.source_lead_id) guarantee at
 * most one auto-created client and opportunity per lead, exactly like the
 * SQL backfill in 0006_platform_backfill.sql. Leads already linked resolve
 * with plain ID reads and no writes.
 */

export interface LeadDomainChain {
  lead: LeadRecord;
  organization: OrganizationRecord;
  brand: BrandRecord;
  client: ClientRecord;
  opportunity: OpportunityRecord;
}

export interface EnsureChainOptions {
  organizationSlug?: string | null;
  brandSlug?: string | null;
}

export async function ensureLeadDomainChain(
  lead: LeadRecord,
  options: EnsureChainOptions = {},
): Promise<LeadDomainChain> {
  const store = getStore();

  // Organization ------------------------------------------------------------
  let organization: OrganizationRecord | null = null;
  if (lead.organization_id) {
    organization = await store.getOrganizationById(lead.organization_id);
  }
  if (!organization && options.organizationSlug) {
    organization = await store.getOrganizationBySlug(options.organizationSlug);
  }
  if (!organization) {
    organization = await resolveDefaultOrganization();
  }

  // Brand -------------------------------------------------------------------
  let brand: BrandRecord | null = null;
  if (lead.brand_id) {
    brand = await store.getBrandById(lead.brand_id);
  }
  if (!brand && options.brandSlug) {
    brand = await store.getBrandBySlug(organization.id, options.brandSlug);
  }
  if (!brand) {
    brand = await resolveDefaultBrand(organization);
  }

  // Client ------------------------------------------------------------------
  let client: ClientRecord | null = null;
  if (lead.client_id) {
    client = await store.getClientById(lead.client_id);
  }
  if (!client) {
    client = await store.getClientBySourceLeadId(lead.id);
  }
  if (!client) {
    try {
      client = await store.createClient({
        organization_id: organization.id,
        source_lead_id: lead.id,
        first_name: lead.first_name,
        last_name: lead.last_name,
        email: lead.email,
        phone: lead.phone,
        state: lead.state,
        status: "prospect",
        source_summary: [lead.source, lead.campaign].filter(Boolean).join(" / ") || null,
      });
    } catch {
      client = await store.getClientBySourceLeadId(lead.id);
      if (!client) throw new Error(`Failed to resolve client for lead ${lead.id}`);
    }
  }

  // Opportunity -------------------------------------------------------------
  let opportunity: OpportunityRecord | null = null;
  if (lead.primary_opportunity_id) {
    opportunity = await store.getOpportunityById(lead.primary_opportunity_id);
  }
  if (!opportunity) {
    opportunity = await store.getOpportunityBySourceLeadId(lead.id);
  }
  if (!opportunity) {
    // Map the legacy advisor assignment onto profile + membership.
    let advisorProfileId: string | null = null;
    let advisorMembershipId: string | null = null;
    if (lead.assigned_advisor_id) {
      const profile = await store.getProfileByLegacyStaffUserId(lead.assigned_advisor_id);
      if (profile) {
        advisorProfileId = profile.id;
        const membership = await store.getMembership(organization.id, profile.id);
        advisorMembershipId = membership?.id ?? null;
      }
    }
    try {
      opportunity = await store.createOpportunity({
        organization_id: organization.id,
        client_id: client.id,
        brand_id: brand.id,
        source_lead_id: lead.id,
        assigned_advisor_profile_id: advisorProfileId,
        assigned_advisor_membership_id: advisorMembershipId,
        stage: lead.current_stage,
        qualification_score: lead.qualification_score,
        qualification_result: lead.qualification_result,
        qualification_reasons: lead.qualification_reasons,
        opened_at: lead.created_at,
        last_activity_at: lead.last_activity_at,
      });
      if (advisorMembershipId) {
        await store.createOpportunityAssignment({
          opportunity_id: opportunity.id,
          membership_id: advisorMembershipId,
          assignment_role: "PRIMARY_ADVISOR",
          is_primary: true,
        });
      }
    } catch {
      opportunity = await store.getOpportunityBySourceLeadId(lead.id);
      if (!opportunity) throw new Error(`Failed to resolve opportunity for lead ${lead.id}`);
    }
  }

  // Persist missing links on the lead --------------------------------------
  let linkedLead = lead;
  if (
    lead.organization_id !== organization.id ||
    lead.client_id !== client.id ||
    lead.primary_opportunity_id !== opportunity.id ||
    lead.brand_id !== brand.id
  ) {
    linkedLead = await store.updateLead(lead.id, {
      organization_id: lead.organization_id ?? organization.id,
      client_id: lead.client_id ?? client.id,
      primary_opportunity_id: lead.primary_opportunity_id ?? opportunity.id,
      brand_id: lead.brand_id ?? brand.id,
    });
  }

  const chain: LeadDomainChain = { lead: linkedLead, organization, brand, client, opportunity };

  // Converge FDD state: environments that predate the platform model (or the
  // dev store) get their opportunity-level workflow created from the lead's
  // legacy fdd_* mirror.
  if (lead.fdd_status !== "not_requested") {
    await syncFddWorkflowFromLead(chain);
  }

  return chain;
}
