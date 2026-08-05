/**
 * Platform domain types: organizations, profiles, memberships, clients,
 * brands, opportunities, assignments, activity events, external mappings,
 * integration connections, territory requests, and opportunity-level FDD
 * workflows. Mirrors supabase/migrations/0005_platform_domain.sql.
 *
 * Naming convention (matches the rest of the codebase):
 *   XxxRecord      — database row shape (snake_case columns)
 *   CreateXxxInput — insert shape accepted by the store
 *   XxxPatch       — partial update shape accepted by the store
 */

// ---------------------------------------------------------------------------
// Organizations
// ---------------------------------------------------------------------------

export const ORGANIZATION_TYPES = [
  "PLATFORM",
  "FSO",
  "BROKERAGE",
  "FRANCHISOR",
  "FRANCHISE_DEVELOPER",
  "AGENCY",
  "OTHER",
] as const;
export type OrganizationType = (typeof ORGANIZATION_TYPES)[number];

export type OrganizationStatus = "active" | "inactive" | "suspended";

export interface OrganizationRecord {
  id: string;
  name: string;
  slug: string;
  organization_type: OrganizationType;
  status: OrganizationStatus;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CreateOrganizationInput {
  name: string;
  slug: string;
  organization_type: OrganizationType;
  status?: OrganizationStatus;
  settings?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Profiles
// ---------------------------------------------------------------------------

export type ProfileStatus = "active" | "invited" | "inactive" | "suspended";

export interface ProfileRecord {
  id: string;
  auth_user_id: string | null;
  legacy_staff_user_id: string | null;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  status: ProfileStatus;
  created_at: string;
  updated_at: string;
}

export interface CreateProfileInput {
  legacy_staff_user_id?: string | null;
  auth_user_id?: string | null;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string | null;
  status?: ProfileStatus;
}

// ---------------------------------------------------------------------------
// Organization memberships
// ---------------------------------------------------------------------------

export const MEMBERSHIP_ROLES = [
  "PLATFORM_ADMIN",
  "ORGANIZATION_ADMIN",
  "ADVISOR",
  "DEVELOPER",
  "SUPPORT",
  "VIEWER",
] as const;
export type MembershipRole = (typeof MEMBERSHIP_ROLES)[number];

export type MembershipStatus = "active" | "invited" | "inactive" | "suspended";

export interface OrganizationMembershipRecord {
  id: string;
  organization_id: string;
  profile_id: string;
  role: MembershipRole;
  status: MembershipStatus;
  permissions: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CreateMembershipInput {
  organization_id: string;
  profile_id: string;
  role: MembershipRole;
  status?: MembershipStatus;
  permissions?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------

export type ClientStatus = "prospect" | "active" | "inactive" | "converted" | "archived";

export interface ClientRecord {
  id: string;
  organization_id: string;
  profile_id: string | null;
  /** Backfill/intake provenance: the lead this client was auto-created from. */
  source_lead_id: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  state: string | null;
  status: ClientStatus;
  source_summary: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateClientInput {
  organization_id: string;
  source_lead_id?: string | null;
  first_name: string;
  last_name: string;
  email?: string | null;
  phone?: string | null;
  state?: string | null;
  status?: ClientStatus;
  source_summary?: string | null;
}

export type ClientPatch = Partial<
  Pick<
    ClientRecord,
    "first_name" | "last_name" | "email" | "phone" | "state" | "status" | "source_summary" | "profile_id"
  >
>;

// ---------------------------------------------------------------------------
// Brands — the Territory Advisor's franchise_brands table IS the platform
// brand entity (one brand model, no duplicate). BrandRecord is an alias so
// platform code reads naturally; the row shape lives in types/territory.ts.
// ---------------------------------------------------------------------------

import type { FranchiseBrandRecord } from "@/types/territory";

export type BrandRecord = FranchiseBrandRecord;

// ---------------------------------------------------------------------------
// Opportunities
// ---------------------------------------------------------------------------

export type OpportunityStatus = "open" | "on_hold" | "won" | "lost" | "archived";
export type OpportunityPriority = "low" | "normal" | "high" | "urgent";

export interface OpportunityRecord {
  id: string;
  organization_id: string;
  client_id: string;
  brand_id: string;
  source_lead_id: string | null;
  assigned_advisor_profile_id: string | null;
  assigned_advisor_membership_id: string | null;
  /** Advisor pipeline stage — same vocabulary as types/advisor.ts InvestorStage. */
  stage: string;
  status: OpportunityStatus;
  qualification_score: number | null;
  qualification_result: string | null;
  qualification_reasons: unknown[] | null;
  priority: OpportunityPriority;
  opened_at: string;
  last_activity_at: string | null;
  closed_at: string | null;
  closed_reason: string | null;
  outcome: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CreateOpportunityInput {
  organization_id: string;
  client_id: string;
  brand_id: string;
  source_lead_id?: string | null;
  assigned_advisor_profile_id?: string | null;
  assigned_advisor_membership_id?: string | null;
  stage?: string;
  status?: OpportunityStatus;
  qualification_score?: number | null;
  qualification_result?: string | null;
  qualification_reasons?: unknown[] | null;
  priority?: OpportunityPriority;
  opened_at?: string;
  last_activity_at?: string | null;
  metadata?: Record<string, unknown>;
}

export type OpportunityPatch = Partial<
  Pick<
    OpportunityRecord,
    | "assigned_advisor_profile_id"
    | "assigned_advisor_membership_id"
    | "stage"
    | "status"
    | "qualification_score"
    | "qualification_result"
    | "qualification_reasons"
    | "priority"
    | "last_activity_at"
    | "closed_at"
    | "closed_reason"
    | "outcome"
    | "metadata"
  >
>;

// ---------------------------------------------------------------------------
// Opportunity assignments
// ---------------------------------------------------------------------------

export const ASSIGNMENT_ROLES = [
  "PRIMARY_ADVISOR",
  "SECONDARY_ADVISOR",
  "DEVELOPER",
  "SUPPORT",
  "OBSERVER",
] as const;
export type AssignmentRole = (typeof ASSIGNMENT_ROLES)[number];

export interface OpportunityAssignmentRecord {
  id: string;
  opportunity_id: string;
  membership_id: string;
  assignment_role: AssignmentRole;
  is_primary: boolean;
  assigned_at: string;
  unassigned_at: string | null;
  created_at: string;
}

export interface CreateOpportunityAssignmentInput {
  opportunity_id: string;
  membership_id: string;
  assignment_role: AssignmentRole;
  is_primary?: boolean;
}

// ---------------------------------------------------------------------------
// External record mappings
// ---------------------------------------------------------------------------

export const EXTERNAL_PROVIDERS = [
  "gohighlevel",
  "facebook",
  "calendly",
  "calcom",
  "wistia",
  "docusign",
  "pandadoc",
  "other",
] as const;
export type ExternalProvider = (typeof EXTERNAL_PROVIDERS)[number];

export const EXTERNAL_ENTITY_TYPES = [
  "client",
  "lead",
  "opportunity",
  "appointment",
  "document",
  "brand",
  "organization",
] as const;
export type ExternalEntityType = (typeof EXTERNAL_ENTITY_TYPES)[number];

export interface ExternalRecordMappingRecord {
  id: string;
  organization_id: string;
  provider: ExternalProvider;
  entity_type: ExternalEntityType;
  internal_entity_id: string;
  external_id: string;
  external_parent_id: string | null;
  metadata: Record<string, unknown>;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpsertExternalMappingInput {
  organization_id: string;
  provider: ExternalProvider;
  entity_type: ExternalEntityType;
  internal_entity_id: string;
  external_id: string;
  external_parent_id?: string | null;
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Integration connections
// ---------------------------------------------------------------------------

export type IntegrationConnectionStatus = "active" | "inactive" | "error";

export interface IntegrationConnectionRecord {
  id: string;
  organization_id: string;
  brand_id: string | null;
  provider: string;
  name: string;
  status: IntegrationConnectionStatus;
  /** Non-secret configuration only. Secrets live behind secret_reference. */
  config: Record<string, unknown>;
  /** Environment-variable name or future vault key — never the secret itself. */
  secret_reference: string | null;
  last_success_at: string | null;
  last_error_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateIntegrationConnectionInput {
  organization_id: string;
  brand_id?: string | null;
  provider: string;
  name: string;
  status?: IntegrationConnectionStatus;
  config?: Record<string, unknown>;
  secret_reference?: string | null;
}

// ---------------------------------------------------------------------------
// Activity events
// ---------------------------------------------------------------------------

export interface ActivityEventRecord {
  id: string;
  organization_id: string;
  client_id: string | null;
  lead_id: string | null;
  opportunity_id: string | null;
  actor_profile_id: string | null;
  event_type: string;
  event_source: string;
  event_data: Record<string, unknown>;
  page_url: string | null;
  external_event_id: string | null;
  legacy_portal_event_id: string | null;
  occurred_at: string;
  created_at: string;
}

export interface CreateActivityEventInput {
  organization_id: string;
  client_id?: string | null;
  lead_id?: string | null;
  opportunity_id?: string | null;
  actor_profile_id?: string | null;
  event_type: string;
  event_source: string;
  event_data?: Record<string, unknown>;
  page_url?: string | null;
  external_event_id?: string | null;
  occurred_at?: string;
}

// ---------------------------------------------------------------------------
// Territory requests: modeled by the Territory Advisor feature's
// territory_searches / territory_review_requests tables (types/territory.ts),
// which carry organization/client/opportunity links. There is deliberately
// no separate territory_requests table.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Opportunity FDD workflows
// ---------------------------------------------------------------------------

import type { FddStatus } from "@/types/fdd";

export interface OpportunityFddWorkflowRecord {
  id: string;
  organization_id: string;
  client_id: string;
  opportunity_id: string;
  brand_id: string;
  status: FddStatus;
  requested_at: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  received_at: string | null;
  eligible_at: string | null;
  provider: string | null;
  provider_envelope_id: string | null;
  external_workflow_id: string | null;
  request_source: string | null;
  last_error: string | null;
  retry_count: number;
  created_at: string;
  updated_at: string;
}

export interface CreateFddWorkflowInput {
  organization_id: string;
  client_id: string;
  opportunity_id: string;
  brand_id: string;
  status?: FddStatus;
}

export type FddWorkflowPatch = Partial<
  Pick<
    OpportunityFddWorkflowRecord,
    | "status"
    | "requested_at"
    | "sent_at"
    | "delivered_at"
    | "received_at"
    | "eligible_at"
    | "provider"
    | "provider_envelope_id"
    | "external_workflow_id"
    | "request_source"
    | "last_error"
    | "retry_count"
  >
>;
