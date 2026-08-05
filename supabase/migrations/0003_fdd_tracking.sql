-- FDD request / acknowledgment tracking on the lead.
-- fdd_requested_at    — when the prospect asked for their electronic FDD copy.
-- fdd_acknowledged_at — when the e-sign / acknowledgment system recorded
--                       receipt (set by the future provider webhook; this
--                       timestamp starts the applicable review period).

alter table public.leads add column if not exists fdd_requested_at timestamptz;
alter table public.leads add column if not exists fdd_acknowledged_at timestamptz;
