-- Facebook lead → private portal activation flow.
-- Applied via: supabase db push (or psql -f) — see README.
--
-- Reuses the existing `leads` table as the portal user + opportunity record
-- (one row already represents one person's engagement with the brand's
-- opportunity — see README "Known MVP limitations"). Adds brand/HighLevel
-- identity columns to it, plus two new tables:
--   - external_leads: Facebook/HighLevel intake staging, pre-claim
--   - portal_activations: the opaque, browser-correlated activation request
--
-- No existing table is duplicated or rebuilt.

-- ---------------------------------------------------------------------------
-- leads: brand + HighLevel identity columns
-- ---------------------------------------------------------------------------
alter table public.leads
  add column if not exists brand_slug text not null default 'cmdt',
  add column if not exists highlevel_contact_id text,
  add column if not exists highlevel_location_id text,
  add column if not exists advisor_id text;

create index if not exists leads_brand_slug_idx on public.leads (brand_slug);

-- One portal user per HighLevel contact per brand (idempotent provisioning).
create unique index if not exists leads_brand_highlevel_contact_unique
  on public.leads (brand_slug, highlevel_contact_id)
  where highlevel_contact_id is not null;

-- ---------------------------------------------------------------------------
-- external_leads: Facebook leads delivered by HighLevel, before they are
-- claimed by an activation request. Unclaimed until matched.
-- ---------------------------------------------------------------------------
create table if not exists public.external_leads (
  id uuid primary key default gen_random_uuid(),
  highlevel_contact_id text not null,
  highlevel_location_id text not null,
  brand_slug text not null,
  advisor_id text,
  first_name text,
  last_name text,
  normalized_email text,
  normalized_phone text,
  phone_last_four text,
  source text,
  facebook_page_id text,
  facebook_form_id text,
  facebook_campaign_id text,
  facebook_ad_id text,
  submitted_at timestamptz,
  received_at timestamptz not null default now(),
  claimed_at timestamptz,
  claimed_by_activation_id uuid,
  matched_lead_id uuid references public.leads (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Scoped per brand, not just per contact: the same HighLevel contact can
  -- legitimately submit Facebook forms for two different brands sharing one
  -- HighLevel location, and each should be its own claimable lead.
  constraint external_leads_hl_contact_unique unique (highlevel_contact_id, highlevel_location_id, brand_slug)
);

create index if not exists external_leads_brand_form_received_idx
  on public.external_leads (brand_slug, facebook_form_id, received_at);
create index if not exists external_leads_brand_source_received_idx
  on public.external_leads (brand_slug, source, received_at);
create index if not exists external_leads_brand_phone4_received_idx
  on public.external_leads (brand_slug, phone_last_four, received_at);
-- Fast "unclaimed, recent" scans — the hot path for every matching attempt.
create index if not exists external_leads_unclaimed_idx
  on public.external_leads (brand_slug, received_at)
  where claimed_at is null;

-- ---------------------------------------------------------------------------
-- portal_activations: one row per browser's activation attempt. The public
-- id is opaque and lives in an HTTP-only cookie — never in the URL.
-- ---------------------------------------------------------------------------
create table if not exists public.portal_activations (
  id uuid primary key default gen_random_uuid(),
  public_activation_id text unique not null,
  brand_slug text not null,
  source text,
  facebook_page_id text,
  facebook_form_id text,
  facebook_campaign_id text,
  facebook_ad_id text,
  status text not null default 'pending',
  matched_external_lead_id uuid references public.external_leads (id) on delete set null,
  portal_lead_id uuid references public.leads (id) on delete set null,
  fallback_attempts integer not null default 0,
  last_match_tier text,
  last_candidate_count integer,
  last_failure_reason text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint portal_activations_status_check check (
    status in ('pending', 'matched', 'fallback_required', 'ready', 'expired')
  )
);

create index if not exists portal_activations_public_id_idx
  on public.portal_activations (public_activation_id);
create index if not exists portal_activations_expires_idx on public.portal_activations (expires_at);
create index if not exists portal_activations_status_idx on public.portal_activations (status);

-- Added after both tables exist.
alter table public.external_leads
  drop constraint if exists external_leads_claimed_by_fk;
alter table public.external_leads
  add constraint external_leads_claimed_by_fk foreign key (claimed_by_activation_id)
  references public.portal_activations (id) on delete set null;

-- An activation may claim at most one lead — extra safety alongside the
-- atomic conditional claim in the store layer.
create unique index if not exists external_leads_single_claim_per_activation
  on public.external_leads (claimed_by_activation_id)
  where claimed_by_activation_id is not null;

alter table public.external_leads enable row level security;
alter table public.portal_activations enable row level security;
