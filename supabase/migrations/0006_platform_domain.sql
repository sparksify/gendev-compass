-- Platform domain model: organizations, profiles, memberships, clients,
-- opportunities, assignments, external mappings, integration connections,
-- activity events, and opportunity-level FDD workflows — plus additive link
-- columns on the existing tables.
--
-- Brand reconciliation: the Territory Advisor migration
-- (0005_territory_advisor.sql) already introduced `franchise_brands` as the
-- DB-backed brand entity, live in production with territory data keyed to
-- it. That table IS the platform brand — this migration deliberately does
-- NOT create a second brand table; it links franchise_brands to
-- organizations and points opportunities at it. Territory activity
-- (territory_searches / territory_review_requests) likewise gains
-- organization/client/opportunity links instead of a parallel table.
--
-- Strictly additive: no existing table, column, constraint, or index is
-- dropped or renamed. Every statement is idempotent so the migration is safe
-- to re-run against an existing database. Backfill lives in
-- 0007_platform_backfill.sql.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- organizations — the tenant boundary. GenDev (FSO) is the first tenant.
-- ---------------------------------------------------------------------------
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  organization_type text not null,
  status text not null default 'active',
  settings jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organizations_type_check check (organization_type in (
    'PLATFORM', 'FSO', 'BROKERAGE', 'FRANCHISOR', 'FRANCHISE_DEVELOPER',
    'AGENCY', 'OTHER'
  )),
  constraint organizations_status_check check (status in (
    'active', 'inactive', 'suspended'
  ))
);

-- ---------------------------------------------------------------------------
-- profiles — application-level identity. Bridges the legacy custom staff
-- auth (legacy_staff_user_id) and future Supabase Auth (auth_user_id).
-- Password hashes stay in staff_users; profiles never hold secrets.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  legacy_staff_user_id uuid unique references public.staff_users (id),
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text,
  avatar_url text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_status_check check (status in (
    'active', 'invited', 'inactive', 'suspended'
  ))
);

-- Platform decision: one profile per email address, case-insensitive.
-- Organization access is granted through memberships, not duplicate profiles.
create unique index if not exists profiles_email_lower_unique
  on public.profiles (lower(email));

-- ---------------------------------------------------------------------------
-- organization_memberships — profile ↔ organization with role and status.
-- ---------------------------------------------------------------------------
create table if not exists public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  profile_id uuid not null references public.profiles (id),
  role text not null,
  status text not null default 'active',
  permissions jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_memberships_unique unique (organization_id, profile_id),
  constraint organization_memberships_role_check check (role in (
    'PLATFORM_ADMIN', 'ORGANIZATION_ADMIN', 'ADVISOR', 'DEVELOPER',
    'SUPPORT', 'VIEWER'
  )),
  constraint organization_memberships_status_check check (status in (
    'active', 'invited', 'inactive', 'suspended'
  ))
);

create index if not exists organization_memberships_profile_idx
  on public.organization_memberships (profile_id);
create index if not exists organization_memberships_org_idx
  on public.organization_memberships (organization_id);

-- ---------------------------------------------------------------------------
-- clients — the canonical person/prospect record within an organization.
-- No global email/phone uniqueness: the same human may appear in multiple
-- organizations, and duplicate management inside one organization is a
-- deliberate human decision (never an automatic merge).
-- source_lead_id records backfill/intake provenance and makes the lead →
-- client backfill deterministic and rerunnable (at most one client is ever
-- auto-created per lead).
-- ---------------------------------------------------------------------------
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  profile_id uuid references public.profiles (id) on delete set null,
  source_lead_id uuid unique references public.leads (id),
  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  state text,
  status text not null default 'prospect',
  source_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clients_status_check check (status in (
    'prospect', 'active', 'inactive', 'converted', 'archived'
  ))
);

create index if not exists clients_org_idx on public.clients (organization_id);
create index if not exists clients_email_lower_idx on public.clients (lower(email));
create index if not exists clients_name_idx on public.clients (last_name, first_name);
create index if not exists clients_status_idx on public.clients (status);

-- ---------------------------------------------------------------------------
-- franchise_brands — organization ownership (additive). Slugs remain
-- globally unique (existing constraint from 0005). Backfilled in 0007.
-- ---------------------------------------------------------------------------
alter table public.franchise_brands
  add column if not exists organization_id uuid references public.organizations (id);

create index if not exists franchise_brands_organization_idx
  on public.franchise_brands (organization_id);

-- ---------------------------------------------------------------------------
-- opportunities — one client's journey for one franchise brand. The new
-- center of brand-specific workflow. Stage semantics are identical to the
-- existing advisor pipeline (leads.current_stage).
--
-- Lead-sourced opportunities are 1:1 with their source lead (partial unique
-- index below) which makes the backfill rerunnable; additional opportunities
-- for a client are created without a source lead. No client+brand uniqueness:
-- a client may legitimately revisit a brand later.
-- ---------------------------------------------------------------------------
create table if not exists public.opportunities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  client_id uuid not null references public.clients (id),
  brand_id uuid not null references public.franchise_brands (id),
  source_lead_id uuid references public.leads (id),
  assigned_advisor_profile_id uuid references public.profiles (id),
  assigned_advisor_membership_id uuid references public.organization_memberships (id),
  stage text not null default 'NEW_LEAD',
  status text not null default 'open',
  qualification_score integer,
  qualification_result text,
  qualification_reasons jsonb,
  priority text not null default 'normal',
  opened_at timestamptz not null default now(),
  last_activity_at timestamptz,
  closed_at timestamptz,
  closed_reason text,
  outcome text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint opportunities_stage_check check (stage in (
    'NEW_LEAD', 'PORTAL_ACTIVE', 'ENGAGED', 'QUESTIONNAIRE_STARTED',
    'QUESTIONNAIRE_COMPLETED', 'CONSULTATION_SCHEDULED',
    'CONSULTATION_COMPLETED', 'FDD_SENT', 'FDD_ACKNOWLEDGED',
    'DUE_DILIGENCE', 'QUALIFIED', 'NOT_A_FIT', 'CLOSED_INVESTED'
  )),
  constraint opportunities_status_check check (status in (
    'open', 'on_hold', 'won', 'lost', 'archived'
  )),
  constraint opportunities_priority_check check (priority in (
    'low', 'normal', 'high', 'urgent'
  ))
);

create unique index if not exists opportunities_source_lead_unique
  on public.opportunities (source_lead_id) where source_lead_id is not null;
create index if not exists opportunities_org_idx on public.opportunities (organization_id);
create index if not exists opportunities_client_idx on public.opportunities (client_id);
create index if not exists opportunities_brand_idx on public.opportunities (brand_id);
create index if not exists opportunities_advisor_idx
  on public.opportunities (assigned_advisor_profile_id);
create index if not exists opportunities_stage_idx on public.opportunities (stage);
create index if not exists opportunities_status_idx on public.opportunities (status);
create index if not exists opportunities_last_activity_idx
  on public.opportunities (last_activity_at);

-- ---------------------------------------------------------------------------
-- opportunity_assignments — many-to-many staffing of an opportunity. The
-- simple assigned_advisor_profile_id column on opportunities remains the
-- efficient primary-advisor read path.
-- ---------------------------------------------------------------------------
create table if not exists public.opportunity_assignments (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities (id),
  membership_id uuid not null references public.organization_memberships (id),
  assignment_role text not null,
  is_primary boolean not null default false,
  assigned_at timestamptz not null default now(),
  unassigned_at timestamptz,
  created_at timestamptz not null default now(),
  constraint opportunity_assignments_role_check check (assignment_role in (
    'PRIMARY_ADVISOR', 'SECONDARY_ADVISOR', 'DEVELOPER', 'SUPPORT', 'OBSERVER'
  ))
);

create index if not exists opportunity_assignments_opportunity_idx
  on public.opportunity_assignments (opportunity_id);
create index if not exists opportunity_assignments_membership_idx
  on public.opportunity_assignments (membership_id);
-- One active assignment per opportunity + membership + role.
create unique index if not exists opportunity_assignments_active_unique
  on public.opportunity_assignments (opportunity_id, membership_id, assignment_role)
  where unassigned_at is null;

-- ---------------------------------------------------------------------------
-- external_record_mappings — provider IDs (GoHighLevel, Facebook, document
-- providers, …) mapped to internal UUIDs. External IDs are never internal
-- primary keys. internal_entity_id is deliberately not a SQL foreign key
-- (it spans entity types); the mapping service is the integrity layer.
-- ---------------------------------------------------------------------------
create table if not exists public.external_record_mappings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  provider text not null,
  entity_type text not null,
  internal_entity_id uuid not null,
  external_id text not null,
  external_parent_id text,
  metadata jsonb not null default '{}',
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint external_record_mappings_provider_check check (provider in (
    'gohighlevel', 'facebook', 'calendly', 'calcom', 'wistia', 'docusign',
    'pandadoc', 'other'
  )),
  constraint external_record_mappings_entity_type_check check (entity_type in (
    'client', 'lead', 'opportunity', 'appointment', 'document', 'brand',
    'organization'
  )),
  -- One external record maps to exactly one internal entity per org +
  -- provider + entity type. Different providers may reuse the same raw ID.
  constraint external_record_mappings_external_unique
    unique (organization_id, provider, entity_type, external_id),
  -- One mapping per internal entity per org + provider + entity type.
  constraint external_record_mappings_internal_unique
    unique (organization_id, provider, entity_type, internal_entity_id)
);

create index if not exists external_record_mappings_internal_idx
  on public.external_record_mappings (internal_entity_id);

-- ---------------------------------------------------------------------------
-- integration_connections — per-organization (optionally per-brand)
-- integration configuration. secret_reference names an environment variable
-- or future vault key; plaintext secrets are never stored in config.
-- ---------------------------------------------------------------------------
create table if not exists public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  brand_id uuid references public.franchise_brands (id),
  provider text not null,
  name text not null,
  status text not null default 'active',
  config jsonb not null default '{}',
  secret_reference text,
  last_success_at timestamptz,
  last_error_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint integration_connections_status_check check (status in (
    'active', 'inactive', 'error'
  ))
);

create index if not exists integration_connections_org_idx
  on public.integration_connections (organization_id);
create index if not exists integration_connections_brand_idx
  on public.integration_connections (brand_id);

-- ---------------------------------------------------------------------------
-- activity_events — generalized, append-only event timeline across the
-- domain. portal_events remains operational; the activity service writes
-- both during the transition. legacy_portal_event_id marks rows copied from
-- portal_events by the backfill so re-runs never duplicate them.
-- References use `on delete set null` where nullable: events are audit data
-- and must survive the referenced row.
-- ---------------------------------------------------------------------------
create table if not exists public.activity_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  client_id uuid references public.clients (id) on delete set null,
  lead_id uuid references public.leads (id) on delete set null,
  opportunity_id uuid references public.opportunities (id) on delete set null,
  actor_profile_id uuid references public.profiles (id) on delete set null,
  event_type text not null,
  event_source text not null,
  event_data jsonb not null default '{}',
  page_url text,
  external_event_id text,
  legacy_portal_event_id uuid unique,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists activity_events_opportunity_timeline_idx
  on public.activity_events (opportunity_id, occurred_at);
create index if not exists activity_events_client_timeline_idx
  on public.activity_events (client_id, occurred_at);
create index if not exists activity_events_type_idx
  on public.activity_events (event_type);
create index if not exists activity_events_occurred_idx
  on public.activity_events (occurred_at);
-- Replay detection for provider-supplied events.
create unique index if not exists activity_events_external_event_unique
  on public.activity_events (organization_id, event_source, external_event_id)
  where external_event_id is not null;

-- ---------------------------------------------------------------------------
-- Territory Advisor linkage (additive). territory_searches /
-- territory_review_requests (from 0005) are the territory data model; they
-- gain organization/client/opportunity links so territory activity attaches
-- to a specific brand opportunity. Backfilled in 0007; nullable during the
-- transition.
-- ---------------------------------------------------------------------------
alter table public.territory_searches
  add column if not exists organization_id uuid references public.organizations (id),
  add column if not exists client_id uuid references public.clients (id),
  add column if not exists opportunity_id uuid references public.opportunities (id);

create index if not exists territory_searches_opportunity_idx
  on public.territory_searches (opportunity_id);
create index if not exists territory_searches_client_idx
  on public.territory_searches (client_id);

alter table public.territory_review_requests
  add column if not exists organization_id uuid references public.organizations (id),
  add column if not exists client_id uuid references public.clients (id),
  add column if not exists opportunity_id uuid references public.opportunities (id);

create index if not exists territory_review_requests_opportunity_idx
  on public.territory_review_requests (opportunity_id);
create index if not exists territory_review_requests_client_idx
  on public.territory_review_requests (client_id);

-- ---------------------------------------------------------------------------
-- opportunity_fdd_workflows — opportunity-scoped FDD state. Status semantics
-- are identical to leads.fdd_status. leads.fdd_* remains the synchronized
-- legacy mirror for the lead's primary opportunity (single write path in
-- the FDD service; no triggers, no reverse sync). One workflow row per
-- opportunity — resends reuse the row, and history lives in fdd_audit_log.
-- ---------------------------------------------------------------------------
create table if not exists public.opportunity_fdd_workflows (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  client_id uuid not null references public.clients (id),
  opportunity_id uuid not null unique references public.opportunities (id),
  brand_id uuid not null references public.franchise_brands (id),
  status text not null default 'not_requested',
  requested_at timestamptz,
  sent_at timestamptz,
  delivered_at timestamptz,
  received_at timestamptz,
  eligible_at timestamptz,
  provider text,
  provider_envelope_id text,
  external_workflow_id text,
  request_source text,
  last_error text,
  retry_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint opportunity_fdd_workflows_status_check check (status in (
    'not_requested', 'request_processing', 'fdd_sent', 'fdd_delivered',
    'fdd_received', 'waiting_period_active', 'eligible_for_agreement',
    'error_manual_review'
  ))
);

create index if not exists opportunity_fdd_workflows_envelope_idx
  on public.opportunity_fdd_workflows (provider_envelope_id);
create index if not exists opportunity_fdd_workflows_status_idx
  on public.opportunity_fdd_workflows (status);

-- ---------------------------------------------------------------------------
-- Additive link columns on existing tables. All nullable: rows created
-- before the backfill (or mid-deploy) must not break, and the application
-- repairs missing links on demand (ensureLeadDomainChain).
-- ---------------------------------------------------------------------------

-- leads → organization / client / primary opportunity / brand
alter table public.leads
  add column if not exists organization_id uuid references public.organizations (id),
  add column if not exists client_id uuid references public.clients (id),
  add column if not exists primary_opportunity_id uuid references public.opportunities (id),
  add column if not exists brand_id uuid references public.franchise_brands (id);

create index if not exists leads_organization_idx on public.leads (organization_id);
create index if not exists leads_client_idx on public.leads (client_id);
create index if not exists leads_primary_opportunity_idx on public.leads (primary_opportunity_id);
create index if not exists leads_brand_idx on public.leads (brand_id);

-- appointments → organization / client / opportunity / advisor profile
alter table public.appointments
  add column if not exists organization_id uuid references public.organizations (id),
  add column if not exists client_id uuid references public.clients (id),
  add column if not exists opportunity_id uuid references public.opportunities (id),
  add column if not exists advisor_profile_id uuid references public.profiles (id);

create index if not exists appointments_opportunity_idx
  on public.appointments (opportunity_id);
create index if not exists appointments_client_idx on public.appointments (client_id);

-- advisor_notes → organization / client / opportunity / author profile.
-- opportunity_id nullable by design: a null opportunity_id on a row whose
-- client_id is set means an intentionally client-level note.
alter table public.advisor_notes
  add column if not exists organization_id uuid references public.organizations (id),
  add column if not exists client_id uuid references public.clients (id),
  add column if not exists opportunity_id uuid references public.opportunities (id),
  add column if not exists author_profile_id uuid references public.profiles (id);

create index if not exists advisor_notes_opportunity_idx
  on public.advisor_notes (opportunity_id);
create index if not exists advisor_notes_client_idx on public.advisor_notes (client_id);

-- questionnaire_submissions (immutable history) → org / client / opportunity / brand
alter table public.questionnaire_submissions
  add column if not exists organization_id uuid references public.organizations (id),
  add column if not exists client_id uuid references public.clients (id),
  add column if not exists opportunity_id uuid references public.opportunities (id),
  add column if not exists brand_id uuid references public.franchise_brands (id);

create index if not exists questionnaire_submissions_opportunity_idx
  on public.questionnaire_submissions (opportunity_id);

-- questionnaire_responses (latest portal snapshot; stays 1:1 per lead) →
-- opportunity link only, so the snapshot can be read per-opportunity.
alter table public.questionnaire_responses
  add column if not exists opportunity_id uuid references public.opportunities (id);

create index if not exists questionnaire_responses_opportunity_idx
  on public.questionnaire_responses (opportunity_id);

-- video_progress → org / client / opportunity / brand. The legacy
-- unique (lead_id) constraint remains until the application is fully
-- opportunity-driven; the partial unique index below is the future-ready
-- rule (one progress row per opportunity + media).
alter table public.video_progress
  add column if not exists organization_id uuid references public.organizations (id),
  add column if not exists client_id uuid references public.clients (id),
  add column if not exists opportunity_id uuid references public.opportunities (id),
  add column if not exists brand_id uuid references public.franchise_brands (id);

create index if not exists video_progress_opportunity_idx
  on public.video_progress (opportunity_id);
create unique index if not exists video_progress_opportunity_media_unique
  on public.video_progress (opportunity_id, wistia_media_id)
  where opportunity_id is not null and wistia_media_id is not null;

-- fdd_audit_log → organization / opportunity / workflow. lead_id remains;
-- existing rows are never modified beyond these additive links.
alter table public.fdd_audit_log
  add column if not exists organization_id uuid references public.organizations (id),
  add column if not exists opportunity_id uuid references public.opportunities (id),
  add column if not exists fdd_workflow_id uuid references public.opportunity_fdd_workflows (id);

create index if not exists fdd_audit_log_opportunity_idx
  on public.fdd_audit_log (opportunity_id);

-- ---------------------------------------------------------------------------
-- Row Level Security. Same posture as the rest of the schema: deny-all for
-- anonymous access; the server's service-role client bypasses RLS. The
-- policies below are intentionally scoped for FUTURE Supabase-Auth access —
-- they grant nothing today because profiles.auth_user_id is null for all
-- rows until the auth migration happens.
-- ---------------------------------------------------------------------------
alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.clients enable row level security;
alter table public.opportunities enable row level security;
alter table public.opportunity_assignments enable row level security;
alter table public.external_record_mappings enable row level security;
alter table public.integration_connections enable row level security;
alter table public.activity_events enable row level security;
alter table public.opportunity_fdd_workflows enable row level security;

-- Helper: the profile bound to the current Supabase Auth user. STABLE,
-- security definer (reads profiles regardless of caller), empty search_path.
create or replace function public.app_current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id
  from public.profiles p
  where p.auth_user_id = auth.uid()
    and p.status = 'active'
  limit 1
$$;

-- Helper: whether the current auth user holds an ACTIVE membership in the
-- given organization.
create or replace function public.app_is_org_member(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_memberships m
    where m.organization_id = org_id
      and m.profile_id = public.app_current_profile_id()
      and m.status = 'active'
  )
$$;

revoke all on function public.app_current_profile_id() from public;
revoke all on function public.app_is_org_member(uuid) from public;
grant execute on function public.app_current_profile_id() to authenticated;
grant execute on function public.app_is_org_member(uuid) to authenticated;

-- Read policies for authenticated users, scoped by active membership.
-- No insert/update/delete policies: all writes stay server-side (service
-- role) in this phase. Anonymous users get nothing.
drop policy if exists organizations_member_read on public.organizations;
create policy organizations_member_read on public.organizations
  for select to authenticated
  using (public.app_is_org_member(id));

drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read on public.profiles
  for select to authenticated
  using (auth_user_id = auth.uid());

drop policy if exists organization_memberships_self_read on public.organization_memberships;
create policy organization_memberships_self_read on public.organization_memberships
  for select to authenticated
  using (profile_id = public.app_current_profile_id());

drop policy if exists clients_member_read on public.clients;
create policy clients_member_read on public.clients
  for select to authenticated
  using (public.app_is_org_member(organization_id));

drop policy if exists franchise_brands_member_read on public.franchise_brands;
create policy franchise_brands_member_read on public.franchise_brands
  for select to authenticated
  using (organization_id is not null and public.app_is_org_member(organization_id));

drop policy if exists opportunities_member_read on public.opportunities;
create policy opportunities_member_read on public.opportunities
  for select to authenticated
  using (public.app_is_org_member(organization_id));

drop policy if exists activity_events_member_read on public.activity_events;
create policy activity_events_member_read on public.activity_events
  for select to authenticated
  using (public.app_is_org_member(organization_id));

drop policy if exists territory_searches_member_read on public.territory_searches;
create policy territory_searches_member_read on public.territory_searches
  for select to authenticated
  using (organization_id is not null and public.app_is_org_member(organization_id));

drop policy if exists territory_review_requests_member_read on public.territory_review_requests;
create policy territory_review_requests_member_read on public.territory_review_requests
  for select to authenticated
  using (organization_id is not null and public.app_is_org_member(organization_id));

drop policy if exists opportunity_fdd_workflows_member_read on public.opportunity_fdd_workflows;
create policy opportunity_fdd_workflows_member_read on public.opportunity_fdd_workflows
  for select to authenticated
  using (public.app_is_org_member(organization_id));

-- integration_connections and external_record_mappings intentionally have
-- NO browser-facing policies (deny-all): integration configuration and
-- provider ID mappings are server-only concerns.
-- opportunity_assignments: readable only via the server for now (deny-all).
