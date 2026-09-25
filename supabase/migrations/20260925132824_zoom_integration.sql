-- Server-only Zoom OAuth connection and registration records.
-- Access is intentionally denied to browser roles; the service-role client is
-- used only from server routes and utilities.

create table if not exists public.zoom_connections (
  id uuid primary key default gen_random_uuid(),
  connection_key text not null unique default 'default',
  access_token_ciphertext text not null,
  refresh_token_ciphertext text not null,
  access_token_expires_at timestamptz not null,
  zoom_user_id text,
  scopes text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.zoom_registrations (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads (id) on delete set null,
  meeting_id text not null,
  email_normalized text not null,
  email text not null,
  first_name text not null,
  last_name text not null,
  registrant_id text,
  join_url text,
  status text not null,
  registered_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint zoom_registrations_status_check check (status in ('registered', 'already_registered', 'failed')),
  constraint zoom_registrations_meeting_email_unique unique (meeting_id, email_normalized)
);

create index if not exists zoom_registrations_lead_idx on public.zoom_registrations (lead_id);

alter table public.zoom_connections enable row level security;
alter table public.zoom_registrations enable row level security;
revoke all on table public.zoom_connections from anon, authenticated;
revoke all on table public.zoom_registrations from anon, authenticated;
