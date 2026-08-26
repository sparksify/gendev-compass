-- Adds a distinct "which internal account this lead came in through" label,
-- separate from `source` (the ad/marketing channel, e.g. "facebook").
-- Two Pabbly webhooks feed lead intake from two different accounts; the
-- HighLevel contact tags "cmdt"/"gendevcompass_cmdt" identify the GenDev
-- account, everything else is Sparks. Left open-ended (no check constraint)
-- since more accounts may be added later without another migration.
alter table public.leads
  add column if not exists intake_account text;

create index if not exists leads_intake_account_idx on public.leads (intake_account);
