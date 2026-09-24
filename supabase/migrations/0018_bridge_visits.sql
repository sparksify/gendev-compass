-- ---------------------------------------------------------------------------
-- bridge_visits — anonymous opens of the bridge page (/watch).
--
-- Every other funnel number is lead-level, but a visitor on the bare bridge
-- URL has no lead until they submit the fit assessment, so their visit
-- could not be counted anywhere. This table is that counter: one row per
-- page open, with the referrer and UTMs that were on the URL. It is never
-- joined to a person; the lead-level story starts when the assessment
-- creates the lead.
-- ---------------------------------------------------------------------------
create table if not exists public.bridge_visits (
  id uuid primary key default gen_random_uuid(),
  path text not null default '/watch',
  referrer text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  created_at timestamptz not null default now()
);

create index if not exists bridge_visits_created_at_idx on public.bridge_visits (created_at desc);

alter table public.bridge_visits enable row level security;
