-- Client detail workspace fields (design handoff: advisor client detail page).
--
-- territories_wanted   advisor's estimate of units wanted (from conversations)
-- lead_type            'organic' | 'broker'; null reads as organic
-- broker_*             broker contact details when lead_type = 'broker'
-- process_milestones   jsonb map of the four sale milestones, e.g.
--                      {"ops_zoom_call": {"status": "attended", "date": "..."}}

alter table leads
  add column if not exists territories_wanted integer,
  add column if not exists lead_type text check (lead_type in ('organic', 'broker')),
  add column if not exists broker_name text,
  add column if not exists broker_network text,
  add column if not exists broker_email text,
  add column if not exists broker_phone text,
  add column if not exists process_milestones jsonb;
