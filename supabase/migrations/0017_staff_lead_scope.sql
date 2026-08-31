-- Brand-level data isolation for staff users.
--
-- lead_scope controls which leads a staff member can see anywhere in the
-- advisor backend (lists, detail, export, dashboard):
--   'all'    — full visibility (Sparks + GenDev). The super-admin scope.
--   'gendev' — GenDev-side only: leads whose source is Sparks-exclusive
--              (facebook-sparks) are hidden everywhere.
--
-- Existing users default to 'all' so nobody is locked out by the migration;
-- admins then restrict GenDev staff from the Team panel. New users created
-- through the API default to 'gendev' (restricted by default).

alter table public.staff_users
  add column if not exists lead_scope text not null default 'all';

alter table public.staff_users
  drop constraint if exists staff_users_lead_scope_check;
alter table public.staff_users
  add constraint staff_users_lead_scope_check check (lead_scope in ('all', 'gendev'));
