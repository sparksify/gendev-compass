-- Advisor backend MVP: staff users, sessions, notes, appointments,
-- versioned questionnaire snapshots, and advisor fields on the existing
-- canonical investor record (leads).
--
-- FDD tracking is NOT duplicated here — the leads.fdd_* columns and
-- fdd_audit_log table (see 0003_fdd_workflow.sql) are the single source of
-- truth for the FDD workflow; the advisor dashboard reads from them
-- directly.

-- ---------------------------------------------------------------------------
-- staff_users
-- ---------------------------------------------------------------------------
create table if not exists public.staff_users (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  email text not null unique,
  password_hash text not null,
  role text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_login_at timestamptz,
  constraint staff_users_role_check check (role in ('ADMIN', 'ADVISOR'))
);

create index if not exists staff_users_email_idx on public.staff_users (email);

-- ---------------------------------------------------------------------------
-- staff_sessions — server-side sessions; only the SHA-256 hash of the
-- session token is stored.
-- ---------------------------------------------------------------------------
create table if not exists public.staff_sessions (
  id uuid primary key default gen_random_uuid(),
  staff_user_id uuid not null references public.staff_users (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists staff_sessions_token_hash_idx on public.staff_sessions (token_hash);
create index if not exists staff_sessions_expires_at_idx on public.staff_sessions (expires_at);

-- ---------------------------------------------------------------------------
-- leads — advisor pipeline fields on the canonical investor record.
-- `status` remains the prospect-facing funnel state; `current_stage` is the
-- advisor pipeline stage.
-- ---------------------------------------------------------------------------
alter table public.leads add column if not exists assigned_advisor_id uuid references public.staff_users (id);
alter table public.leads add column if not exists current_stage text not null default 'NEW_LEAD';
alter table public.leads add column if not exists last_activity_at timestamptz;
alter table public.leads add column if not exists state text;

alter table public.leads drop constraint if exists leads_current_stage_check;
alter table public.leads add constraint leads_current_stage_check check (current_stage in (
  'NEW_LEAD', 'PORTAL_ACTIVE', 'ENGAGED', 'QUESTIONNAIRE_STARTED',
  'QUESTIONNAIRE_COMPLETED', 'CONSULTATION_SCHEDULED', 'CONSULTATION_COMPLETED',
  'FDD_SENT', 'FDD_ACKNOWLEDGED', 'DUE_DILIGENCE', 'QUALIFIED', 'NOT_A_FIT',
  'CLOSED_INVESTED'
));

create index if not exists leads_assigned_advisor_idx on public.leads (assigned_advisor_id);
create index if not exists leads_current_stage_idx on public.leads (current_stage);
create index if not exists leads_last_activity_idx on public.leads (last_activity_at);

-- Backfill pipeline stage and activity for existing rows.
update public.leads set current_stage = case
  when status = 'booked' then 'CONSULTATION_SCHEDULED'
  when status in ('questionnaire_completed', 'qualified', 'review_required', 'calendar_viewed')
    then 'QUESTIONNAIRE_COMPLETED'
  when status = 'questionnaire_started' then 'QUESTIONNAIRE_STARTED'
  when status in ('video_started', 'video_in_progress', 'video_completed') then 'ENGAGED'
  when status = 'portal_opened' then 'PORTAL_ACTIVE'
  else 'NEW_LEAD'
end
where current_stage = 'NEW_LEAD';

update public.leads set last_activity_at = greatest(
  coalesce(portal_first_opened_at, created_at),
  coalesce(video_started_at, created_at),
  coalesce(questionnaire_completed_at, created_at),
  coalesce(booked_at, created_at),
  created_at
)
where last_activity_at is null;

-- ---------------------------------------------------------------------------
-- portal_events — audit metadata. Events remain append-only.
-- occurred_at is for provider-supplied timestamps; created_at remains the
-- ingestion time and the fallback ordering key.
-- ---------------------------------------------------------------------------
alter table public.portal_events add column if not exists event_source text not null default 'portal';
alter table public.portal_events add column if not exists created_by_staff_user_id uuid references public.staff_users (id);
alter table public.portal_events add column if not exists occurred_at timestamptz;

-- ---------------------------------------------------------------------------
-- video_progress — engagement summary fields.
-- ---------------------------------------------------------------------------
alter table public.video_progress add column if not exists play_count integer not null default 0;
alter table public.video_progress add column if not exists first_played_at timestamptz;

-- ---------------------------------------------------------------------------
-- questionnaire_submissions / questionnaire_answers — immutable, versioned
-- snapshot of exactly what was asked and answered. The existing 1:1
-- questionnaire_responses table continues to power the prospect portal.
-- ---------------------------------------------------------------------------
create table if not exists public.questionnaire_submissions (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  questionnaire_version text not null,
  submitted_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists questionnaire_submissions_lead_idx on public.questionnaire_submissions (lead_id);

create table if not exists public.questionnaire_answers (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.questionnaire_submissions (id) on delete cascade,
  question_key text not null,
  question_text text not null,
  answer_value text not null,
  answer_display_value text not null,
  created_at timestamptz not null default now()
);

create index if not exists questionnaire_answers_submission_idx on public.questionnaire_answers (submission_id);

-- ---------------------------------------------------------------------------
-- advisor_notes
-- ---------------------------------------------------------------------------
create table if not exists public.advisor_notes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  staff_user_id uuid not null references public.staff_users (id),
  note text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists advisor_notes_lead_idx on public.advisor_notes (lead_id);

-- ---------------------------------------------------------------------------
-- appointments
-- ---------------------------------------------------------------------------
create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  advisor_id uuid references public.staff_users (id),
  external_appointment_id text,
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  time_zone text,
  status text not null default 'SCHEDULED',
  booking_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointments_status_check check (status in (
    'SCHEDULED', 'RESCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'
  ))
);

create index if not exists appointments_lead_idx on public.appointments (lead_id);
create index if not exists appointments_external_idx on public.appointments (external_appointment_id);

-- ---------------------------------------------------------------------------
-- Row Level Security: deny-all, same model as every other table — only the
-- server's service-role client can read or write.
-- ---------------------------------------------------------------------------
alter table public.staff_users enable row level security;
alter table public.staff_sessions enable row level security;
alter table public.questionnaire_submissions enable row level security;
alter table public.questionnaire_answers enable row level security;
alter table public.advisor_notes enable row level security;
alter table public.appointments enable row level security;
