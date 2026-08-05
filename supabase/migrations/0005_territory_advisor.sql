-- Territory Advisor: preliminary territory-screening feature.
-- Applied via: supabase db push (or psql -f) — see README.
--
-- Introduces the first DB-backed brand entity (`franchise_brands`). Today the
-- app is single-brand (CMDT, hardcoded in lib/config/opportunity.ts); this
-- table formalizes "brand" so state eligibility and territory records have
-- something to key off, without touching the existing config-driven
-- Opportunity Overview page. Every territory table is brand_id-scoped so a
-- second brand is a matter of inserting a row, not a schema change.

-- ---------------------------------------------------------------------------
-- franchise_brands
-- ---------------------------------------------------------------------------
create table if not exists public.franchise_brands (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  active boolean not null default true,
  default_radius_miles integer not null default 10,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists franchise_brands_slug_idx on public.franchise_brands (slug);

-- ---------------------------------------------------------------------------
-- brand_state_eligibility — per brand, per state (2-letter USPS code).
-- Deliberately no blanket default: a state with no row is treated as
-- MANUAL_REVIEW by the application, never AVAILABLE (see lib/territory/).
-- ---------------------------------------------------------------------------
create table if not exists public.brand_state_eligibility (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.franchise_brands (id) on delete cascade,
  state_code text not null,
  status text not null,
  effective_date date,
  expiration_date date,
  notes_internal text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint brand_state_eligibility_status_check check (status in (
    'approved', 'pending', 'not_registered', 'exempt', 'restricted', 'manual_review'
  )),
  constraint brand_state_eligibility_state_code_check check (state_code ~ '^[A-Z]{2}$'),
  constraint brand_state_eligibility_brand_state_unique unique (brand_id, state_code)
);

create index if not exists brand_state_eligibility_brand_idx on public.brand_state_eligibility (brand_id);
create index if not exists brand_state_eligibility_state_idx on public.brand_state_eligibility (state_code);

-- ---------------------------------------------------------------------------
-- territory_definitions — zip_list/radius supported fully today; county and
-- polygon values are accepted by the check constraint so the schema doesn't
-- need to change when that support is added, but no evaluation logic exists
-- for them yet (they resolve to MANUAL_REVIEW).
-- ---------------------------------------------------------------------------
create table if not exists public.territory_definitions (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.franchise_brands (id) on delete cascade,
  territory_name text not null,
  territory_code text,
  definition_type text not null,
  status text not null default 'available',
  center_latitude numeric,
  center_longitude numeric,
  radius_miles numeric,
  public_display_level text not null default 'hidden',
  internal_notes text,
  awarded_at timestamptz,
  reserved_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint territory_definitions_definition_type_check check (definition_type in (
    'zip_list', 'radius', 'county', 'polygon', 'manual'
  )),
  constraint territory_definitions_status_check check (status in (
    'available', 'reserved', 'sold', 'corporate', 'unavailable', 'pending', 'archived'
  )),
  constraint territory_definitions_display_level_check check (public_display_level in (
    'hidden', 'generalized', 'exact'
  ))
);

create index if not exists territory_definitions_brand_idx on public.territory_definitions (brand_id);
create index if not exists territory_definitions_status_idx on public.territory_definitions (status);

-- ---------------------------------------------------------------------------
-- territory_zip_codes
-- ---------------------------------------------------------------------------
create table if not exists public.territory_zip_codes (
  id uuid primary key default gen_random_uuid(),
  territory_definition_id uuid not null references public.territory_definitions (id) on delete cascade,
  zip_code text not null,
  created_at timestamptz not null default now(),
  constraint territory_zip_codes_unique unique (territory_definition_id, zip_code)
);

create index if not exists territory_zip_codes_zip_idx on public.territory_zip_codes (zip_code);
create index if not exists territory_zip_codes_territory_idx on public.territory_zip_codes (territory_definition_id);

-- ---------------------------------------------------------------------------
-- zip_code_reference — geocoding/lookup source of truth for the built-in
-- provider (lib/geocoding/). Demographic columns are nullable; the app must
-- work gracefully when they're absent. Not brand-scoped (shared reference
-- data).
-- ---------------------------------------------------------------------------
create table if not exists public.zip_code_reference (
  zip_code text primary key,
  city text not null,
  state_code text not null,
  county_name text,
  latitude numeric not null,
  longitude numeric not null,
  population integer,
  households integer,
  median_household_income integer,
  timezone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists zip_code_reference_state_idx on public.zip_code_reference (state_code);
create index if not exists zip_code_reference_city_state_idx on public.zip_code_reference (city, state_code);

-- ---------------------------------------------------------------------------
-- territory_searches — one row per evaluated search (initial + follow-up).
-- lead_id follows this app's convention of `leads` as the canonical prospect
-- record (there is no separate "user" table for portal visitors).
-- ---------------------------------------------------------------------------
create table if not exists public.territory_searches (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  brand_id uuid not null references public.franchise_brands (id) on delete cascade,
  raw_query text not null,
  normalized_location text,
  latitude numeric,
  longitude numeric,
  city text,
  state_code text,
  zip_code text,
  radius_miles numeric,
  result_status text not null,
  result_summary jsonb,
  matched_territory_count integer not null default 0,
  request_manual_review boolean not null default false,
  created_at timestamptz not null default now(),
  constraint territory_searches_result_status_check check (result_status in (
    'AVAILABLE', 'PARTIALLY_AVAILABLE', 'UNAVAILABLE', 'STATE_RESTRICTED',
    'MANUAL_REVIEW', 'LOCATION_NOT_FOUND', 'BRAND_NOT_CONFIGURED'
  ))
);

create index if not exists territory_searches_lead_idx on public.territory_searches (lead_id);
create index if not exists territory_searches_brand_idx on public.territory_searches (brand_id);
create index if not exists territory_searches_created_at_idx on public.territory_searches (created_at);
create index if not exists territory_searches_result_status_idx on public.territory_searches (result_status);

-- ---------------------------------------------------------------------------
-- territory_review_requests
-- ---------------------------------------------------------------------------
create table if not exists public.territory_review_requests (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  brand_id uuid not null references public.franchise_brands (id) on delete cascade,
  territory_search_id uuid references public.territory_searches (id) on delete set null,
  status text not null default 'new',
  prospect_message text,
  assigned_to uuid references public.staff_users (id),
  reviewed_at timestamptz,
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint territory_review_requests_status_check check (status in (
    'new', 'in_review', 'contacted', 'approved', 'declined', 'closed'
  ))
);

create index if not exists territory_review_requests_lead_idx on public.territory_review_requests (lead_id);
create index if not exists territory_review_requests_brand_idx on public.territory_review_requests (brand_id);
create index if not exists territory_review_requests_status_idx on public.territory_review_requests (status);
create index if not exists territory_review_requests_assigned_idx on public.territory_review_requests (assigned_to);

-- ---------------------------------------------------------------------------
-- Row Level Security: deny-all, same model as every other table — only the
-- server's service-role client can read or write.
-- ---------------------------------------------------------------------------
alter table public.franchise_brands enable row level security;
alter table public.brand_state_eligibility enable row level security;
alter table public.territory_definitions enable row level security;
alter table public.territory_zip_codes enable row level security;
alter table public.zip_code_reference enable row level security;
alter table public.territory_searches enable row level security;
alter table public.territory_review_requests enable row level security;

-- ---------------------------------------------------------------------------
-- Seed the single existing brand (CMDT) so territory data has a brand_id to
-- attach to immediately. Safe to run more than once.
-- ---------------------------------------------------------------------------
insert into public.franchise_brands (slug, name, default_radius_miles)
values ('cmdt', 'Complete Mobile Drug Testing', 10)
on conflict (slug) do nothing;
