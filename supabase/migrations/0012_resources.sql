-- Resources: an admin-managed, growable list of files shown on the
-- portal's standalone Resources page. Distinct from `site_assets` (a fixed
-- set of named slots — logo, presentation, one-sheet): this is an
-- open-ended list an admin can add to or remove from over time, so it's
-- modeled as a real table rather than another slot key.

create table if not exists public.resources (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  url text not null,
  filename text,
  content_type text,
  size_bytes bigint,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists resources_sort_order_idx on public.resources (sort_order, created_at);

alter table public.resources enable row level security;

-- Files live in the existing public `portal-assets` bucket under a
-- `resources/` prefix — no new bucket needed.
