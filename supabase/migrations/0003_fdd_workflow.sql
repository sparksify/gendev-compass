-- FDD Request workflow: status tracking on leads plus a dedicated audit log.
-- Applied via: supabase db push (or psql -f) — see README.

-- ---------------------------------------------------------------------------
-- leads: FDD workflow fields
-- ---------------------------------------------------------------------------
alter table public.leads
  add column if not exists fdd_status text not null default 'not_requested',
  add column if not exists fdd_requested_at timestamptz,
  add column if not exists fdd_sent_at timestamptz,
  add column if not exists fdd_delivered_at timestamptz,
  add column if not exists fdd_received_at timestamptz,
  add column if not exists fdd_eligible_at timestamptz,
  add column if not exists fdd_provider_envelope_id text,
  add column if not exists fdd_workflow_id text,
  add column if not exists fdd_request_source text,
  add column if not exists fdd_last_error text,
  add column if not exists fdd_retry_count integer not null default 0;

alter table public.leads
  drop constraint if exists leads_fdd_status_check;
alter table public.leads
  add constraint leads_fdd_status_check check (fdd_status in (
    'not_requested', 'request_processing', 'fdd_sent', 'fdd_delivered',
    'fdd_received', 'waiting_period_active', 'eligible_for_agreement',
    'error_manual_review'
  ));

create index if not exists leads_fdd_status_idx on public.leads (fdd_status);
create index if not exists leads_fdd_envelope_idx on public.leads (fdd_provider_envelope_id);

-- ---------------------------------------------------------------------------
-- fdd_audit_log: immutable trail of every FDD workflow event. Rows are only
-- ever inserted — corrections are recorded as new entries, never edits.
-- ---------------------------------------------------------------------------
create table if not exists public.fdd_audit_log (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  event text not null,
  source text not null,
  actor text not null,
  external_event_id text,
  ip_address text,
  before_values jsonb,
  after_values jsonb,
  error text,
  created_at timestamptz not null default now()
);

create index if not exists fdd_audit_log_lead_id_idx on public.fdd_audit_log (lead_id);
create index if not exists fdd_audit_log_event_idx on public.fdd_audit_log (event);
create index if not exists fdd_audit_log_external_event_idx
  on public.fdd_audit_log (external_event_id);
create index if not exists fdd_audit_log_created_at_idx on public.fdd_audit_log (created_at);

alter table public.fdd_audit_log enable row level security;
