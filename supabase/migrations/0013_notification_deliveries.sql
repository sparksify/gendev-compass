-- Advisor notification deliveries.
--
-- Activity itself is already recorded in activity_events (0006) — this table
-- is only the record of *telling a human about it*: one row per attempt,
-- including the ones that fail, so a misconfigured sender or a provider
-- outage is diagnosable after the fact instead of living only in logs.
--
-- Kept separate from activity_events rather than added as columns there:
-- one event can eventually fan out to several channels (email now; SMS,
-- Slack, digest later), which is a one-to-many relationship.

create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id),
  lead_id uuid references public.leads (id) on delete set null,
  -- Nullable: leads whose domain chain predates 0006 have no activity row.
  activity_event_id uuid references public.activity_events (id) on delete set null,
  event_type text not null,
  -- text, not an enum, so adding 'sms'/'slack' needs no migration.
  channel text not null default 'email',
  template_key text not null,
  -- Nullable so a "no recipient configured" attempt is still recorded.
  recipient text,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'failed')),
  provider text,
  provider_message_id text,
  error_message text,
  -- The idempotency gate. Claiming this key is what authorizes a send, so a
  -- retried submission or a second delivery path (portal confirmation vs.
  -- calendar webhook) cannot produce a duplicate email.
  dedupe_key text not null,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists notification_deliveries_dedupe_key_unique
  on public.notification_deliveries (dedupe_key);

create index if not exists notification_deliveries_lead_idx
  on public.notification_deliveries (lead_id, created_at desc);
-- Supports "what failed to send?" without a full scan.
create index if not exists notification_deliveries_status_idx
  on public.notification_deliveries (status, created_at desc)
  where status <> 'sent';

alter table public.notification_deliveries enable row level security;

-- Read policy scoped by active organization membership, matching every other
-- member-readable table in 0006. Writes stay server-side (service role):
-- there is deliberately no insert/update/delete policy, so a browser session
-- can never create or retarget a notification.
drop policy if exists notification_deliveries_member_read on public.notification_deliveries;
create policy notification_deliveries_member_read on public.notification_deliveries
  for select to authenticated
  using (organization_id is not null and public.app_is_org_member(organization_id));
