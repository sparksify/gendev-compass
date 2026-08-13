-- Ownership Profile persistence.
--
-- The assessment previously lived only in the investor's browser
-- (localStorage, keyed by portal token), which meant the answers never
-- reached the advisor, could not be notified on, and were lost whenever the
-- investor cleared their cache or switched devices. This table makes it a
-- real record.
--
-- Saved progressively rather than only on completion: a partial profile is
-- still useful call preparation, and abandoning at section six should not
-- discard the first five. `completed_at` marks a genuine finish and is what
-- the notification layer keys on.
--
-- Multi-valued answers are text[] rather than jsonb so they stay queryable
-- ("which investors care about recurring revenue?") without unpacking JSON.
-- Values are the option keys from types/ownershipProfile.ts; labels live in
-- application code so wording can change without a data migration.

create table if not exists public.ownership_profiles (
  id uuid primary key default gen_random_uuid(),
  -- One profile per investor; the portal upserts it as they answer.
  lead_id uuid not null unique references public.leads (id) on delete cascade,

  motivations text[] not null default '{}',
  activities text[] not null default '{}',
  -- 0 = fully hands-on, 100 = fully executive/absentee.
  ownership_style integer not null default 50
    check (ownership_style between 0 and 100),
  growth_comfort text,
  environments text[] not null default '{}',
  priorities text[] not null default '{}',
  experience text[] not null default '{}',
  timeline text,

  -- Resume position and progress, so a returning investor picks up where
  -- they stopped even on a different device.
  current_step integer not null default 0,
  answered_sections integer not null default 0,
  completed_at timestamptz,

  -- Platform domain links, mirroring questionnaire_responses.
  organization_id uuid references public.organizations (id),
  client_id uuid references public.clients (id) on delete set null,
  opportunity_id uuid references public.opportunities (id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ownership_profiles_completed_idx
  on public.ownership_profiles (completed_at desc)
  where completed_at is not null;
create index if not exists ownership_profiles_opportunity_idx
  on public.ownership_profiles (opportunity_id);

alter table public.ownership_profiles enable row level security;

-- Read policy scoped by active organization membership, matching the other
-- member-readable tables. Writes stay server-side (service role): the portal
-- route validates and attributes every save to the token's own lead, so a
-- browser session can never write another investor's profile.
drop policy if exists ownership_profiles_member_read on public.ownership_profiles;
create policy ownership_profiles_member_read on public.ownership_profiles
  for select to authenticated
  using (organization_id is not null and public.app_is_org_member(organization_id));
