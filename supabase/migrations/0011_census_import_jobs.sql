-- 0011_census_import_jobs.sql
-- Census ACS demographics moves from "an admin clicks a button and waits"
-- to backend infrastructure: a job-tracking table the server-side worker
-- updates as it runs, independent of any browser tab, plus a durable raw
-- layer so a bad normalization run can be reprocessed without re-fetching
-- from census.gov. See lib/geocoding/censusJob.ts.
--
-- Structure only — no bulk data loading in migrations (see
-- docs/territory-advisor.md, "Nationwide ZIP data pipeline").

create table if not exists public.census_import_jobs (
  id uuid primary key default gen_random_uuid(),
  status text not null check (status in ('running', 'succeeded', 'failed')),
  -- What started the job: the scheduled health-check cron, a staff
  -- member's manual "Run Manual Refresh" click, or the system
  -- auto-detecting empty/incomplete data with no human involved.
  trigger text not null check (trigger in ('cron', 'manual', 'system')),
  vintage text not null,
  states_total integer not null,
  states_done integer not null default 0,
  states_failed integer not null default 0,
  last_error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists census_import_jobs_status_idx
  on public.census_import_jobs (status);
create index if not exists census_import_jobs_started_at_idx
  on public.census_import_jobs (started_at desc);

alter table public.census_import_jobs enable row level security;

-- Durable raw layer: the Census figures per ZCTA exactly as returned by the
-- ACS API for one state/vintage, before being joined onto our own ZIP
-- reference and written to zip_code_reference (the normalized layer the
-- application actually queries). One row per (vintage, state_code) — a
-- re-fetch replaces the prior capture rather than growing without bound.
create table if not exists public.census_acs_raw (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.census_import_jobs(id) on delete set null,
  vintage text not null,
  state_code text not null,
  variables text[] not null,
  payload jsonb not null,
  fetched_at timestamptz not null default now(),
  unique (vintage, state_code)
);

create index if not exists census_acs_raw_vintage_idx
  on public.census_acs_raw (vintage);

alter table public.census_acs_raw enable row level security;
