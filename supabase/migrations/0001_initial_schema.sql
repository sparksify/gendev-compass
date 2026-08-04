-- Investor Qualification Portal — initial schema.
-- Applied via: supabase db push (or psql -f) — see README.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- leads
-- ---------------------------------------------------------------------------
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  portal_token text unique not null,
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text,
  source text,
  campaign text,
  ad_set text,
  ad text,
  facebook_lead_id text,
  initial_liquid_capital text,
  initial_net_worth text,
  initial_business_owner boolean,
  status text not null default 'created',
  qualification_score integer,
  qualification_result text,
  qualification_reasons jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  portal_first_opened_at timestamptz,
  video_started_at timestamptz,
  video_completed_at timestamptz,
  questionnaire_started_at timestamptz,
  questionnaire_completed_at timestamptz,
  qualified_at timestamptz,
  calendar_viewed_at timestamptz,
  booked_at timestamptz,
  appointment_id text,
  appointment_start_at timestamptz,
  constraint leads_status_check check (status in (
    'created', 'portal_opened', 'video_started', 'video_in_progress',
    'video_completed', 'questionnaire_started', 'questionnaire_completed',
    'qualified', 'review_required', 'calendar_viewed', 'booked'
  )),
  constraint leads_qualification_result_check check (
    qualification_result is null or qualification_result in ('qualified', 'review_required')
  )
);

create index if not exists leads_portal_token_idx on public.leads (portal_token);
create index if not exists leads_status_idx on public.leads (status);
create index if not exists leads_created_at_idx on public.leads (created_at);

-- ---------------------------------------------------------------------------
-- video_progress
-- ---------------------------------------------------------------------------
create table if not exists public.video_progress (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  wistia_media_id text,
  highest_percent_watched decimal not null default 0,
  accumulated_seconds_watched integer not null default 0,
  last_playhead_position decimal not null default 0,
  started boolean not null default false,
  completed boolean not null default false,
  last_event_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint video_progress_lead_unique unique (lead_id)
);

create index if not exists video_progress_lead_id_idx on public.video_progress (lead_id);

-- ---------------------------------------------------------------------------
-- questionnaire_responses
-- ---------------------------------------------------------------------------
create table if not exists public.questionnaire_responses (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null unique references public.leads (id) on delete cascade,
  investment_timeline text not null,
  liquid_capital text not null,
  net_worth text not null,
  business_ownership text not null,
  primary_interest text not null,
  remaining_questions text not null,
  decision_criteria text not null,
  decision_participants text not null,
  accuracy_confirmed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- portal_events
-- ---------------------------------------------------------------------------
create table if not exists public.portal_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  event_name text not null,
  event_data jsonb,
  page_url text,
  created_at timestamptz not null default now()
);

create index if not exists portal_events_lead_id_idx on public.portal_events (lead_id);
create index if not exists portal_events_event_name_idx on public.portal_events (event_name);
create index if not exists portal_events_created_at_idx on public.portal_events (created_at);

-- ---------------------------------------------------------------------------
-- Row Level Security: deny-all by default. The application only connects with
-- the service-role key (server-side), which bypasses RLS. The anon key has no
-- access to any of these tables.
-- ---------------------------------------------------------------------------
alter table public.leads enable row level security;
alter table public.video_progress enable row level security;
alter table public.questionnaire_responses enable row level security;
alter table public.portal_events enable row level security;
