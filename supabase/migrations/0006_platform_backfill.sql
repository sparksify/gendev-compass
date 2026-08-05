-- Platform domain backfill: connects every existing record to the new
-- organization / client / brand / opportunity model.
--
-- Deterministic and rerunnable: every insert is keyed on a uniqueness
-- constraint (organizations.slug, brands org+slug, profiles.legacy_staff_user_id,
-- clients.source_lead_id, opportunities.source_lead_id,
-- opportunity_fdd_workflows.opportunity_id, activity_events.legacy_portal_event_id)
-- so re-running the migration never duplicates a row. Updates only fill
-- NULL link columns — existing values are never overwritten, and no legacy
-- column is modified.

-- ---------------------------------------------------------------------------
-- 1. The GenDev organization (first tenant). Reuses the row if it already
--    exists — no hard-coded UUID.
-- ---------------------------------------------------------------------------
insert into public.organizations (name, slug, organization_type, status)
select 'GenDev', 'gendev', 'FSO', 'active'
where not exists (select 1 from public.organizations where slug = 'gendev');

-- ---------------------------------------------------------------------------
-- 2. Default brand for the currently configured portal. Migrations cannot
--    read the deployment's environment configuration, so this is a clearly
--    marked placeholder: the administrator should rename it (or create the
--    real brand and point DEFAULT_BRAND_SLUG at it) after applying
--    migrations. brand_settings.requires_configuration flags it in-app.
-- ---------------------------------------------------------------------------
insert into public.brands (organization_id, name, slug, status, brand_settings)
select o.id,
       'GenDev Compass Default Brand',
       'default',
       'active',
       jsonb_build_object('requires_configuration', true)
from public.organizations o
where o.slug = 'gendev'
  and not exists (
    select 1 from public.brands b
    where b.organization_id = o.id and b.slug = 'default'
  );

-- ---------------------------------------------------------------------------
-- 3. One profile per existing staff user. Password hashes stay in
--    staff_users. Skips any staff user whose email already belongs to a
--    profile (manual reconciliation is safer than guessing).
-- ---------------------------------------------------------------------------
insert into public.profiles
  (legacy_staff_user_id, first_name, last_name, email, status)
select s.id,
       s.first_name,
       s.last_name,
       s.email,
       case when s.active then 'active' else 'inactive' end
from public.staff_users s
where not exists (
    select 1 from public.profiles p where p.legacy_staff_user_id = s.id
  )
  and not exists (
    select 1 from public.profiles p where lower(p.email) = lower(s.email)
  );

-- ---------------------------------------------------------------------------
-- 4. GenDev memberships for every legacy staff profile.
--    ADMIN → ORGANIZATION_ADMIN, ADVISOR → ADVISOR.
-- ---------------------------------------------------------------------------
insert into public.organization_memberships (organization_id, profile_id, role, status)
select o.id,
       p.id,
       case s.role when 'ADMIN' then 'ORGANIZATION_ADMIN' else 'ADVISOR' end,
       case when s.active then 'active' else 'inactive' end
from public.profiles p
join public.staff_users s on s.id = p.legacy_staff_user_id
cross join public.organizations o
where o.slug = 'gendev'
on conflict (organization_id, profile_id) do nothing;

-- ---------------------------------------------------------------------------
-- 5. One client per existing lead (provenance: clients.source_lead_id).
--    No merging — duplicate humans remain separate rows for deliberate
--    human reconciliation.
-- ---------------------------------------------------------------------------
insert into public.clients
  (organization_id, source_lead_id, first_name, last_name, email, phone, state,
   status, source_summary)
select o.id,
       l.id,
       l.first_name,
       l.last_name,
       l.email,
       l.phone,
       l.state,
       'prospect',
       nullif(concat_ws(' / ', l.source, l.campaign), '')
from public.leads l
cross join public.organizations o
where o.slug = 'gendev'
on conflict (source_lead_id) do nothing;

-- ---------------------------------------------------------------------------
-- 6. One opportunity per existing lead (provenance:
--    opportunities.source_lead_id, partial unique index). Copies the advisor
--    pipeline stage, qualification, activity timestamps, and maps the
--    assigned advisor to their profile + GenDev membership.
-- ---------------------------------------------------------------------------
insert into public.opportunities
  (organization_id, client_id, brand_id, source_lead_id,
   assigned_advisor_profile_id, assigned_advisor_membership_id,
   stage, status, qualification_score, qualification_result,
   qualification_reasons, opened_at, last_activity_at)
select o.id,
       c.id,
       b.id,
       l.id,
       p.id,
       m.id,
       l.current_stage,
       'open',
       l.qualification_score,
       l.qualification_result,
       l.qualification_reasons,
       l.created_at,
       l.last_activity_at
from public.leads l
join public.organizations o on o.slug = 'gendev'
join public.clients c on c.source_lead_id = l.id
join public.brands b on b.organization_id = o.id and b.slug = 'default'
left join public.profiles p on p.legacy_staff_user_id = l.assigned_advisor_id
left join public.organization_memberships m
  on m.organization_id = o.id and m.profile_id = p.id
where not exists (
  select 1 from public.opportunities op where op.source_lead_id = l.id
);

-- Mirror the primary assignment into opportunity_assignments so the
-- many-to-many model is populated from day one.
insert into public.opportunity_assignments
  (opportunity_id, membership_id, assignment_role, is_primary)
select op.id, op.assigned_advisor_membership_id, 'PRIMARY_ADVISOR', true
from public.opportunities op
where op.assigned_advisor_membership_id is not null
  and not exists (
    select 1 from public.opportunity_assignments a
    where a.opportunity_id = op.id
      and a.membership_id = op.assigned_advisor_membership_id
      and a.assignment_role = 'PRIMARY_ADVISOR'
      and a.unassigned_at is null
  );

-- ---------------------------------------------------------------------------
-- 7. Link leads to their organization, client, primary opportunity, brand.
--    Fills NULLs only.
-- ---------------------------------------------------------------------------
update public.leads l
set organization_id = op.organization_id,
    client_id = op.client_id,
    primary_opportunity_id = op.id,
    brand_id = op.brand_id
from public.opportunities op
where op.source_lead_id = l.id
  and (l.organization_id is null or l.client_id is null
       or l.primary_opportunity_id is null or l.brand_id is null);

-- ---------------------------------------------------------------------------
-- 8. Backfill links on child tables from each row's lead. Fills NULLs only;
--    legacy lead_id / advisor_id / staff_user_id columns are untouched.
-- ---------------------------------------------------------------------------
update public.appointments a
set organization_id = l.organization_id,
    client_id = l.client_id,
    opportunity_id = l.primary_opportunity_id
from public.leads l
where a.lead_id = l.id
  and (a.organization_id is null or a.client_id is null or a.opportunity_id is null);

update public.appointments a
set advisor_profile_id = p.id
from public.profiles p
where p.legacy_staff_user_id = a.advisor_id
  and a.advisor_id is not null
  and a.advisor_profile_id is null;

update public.advisor_notes n
set organization_id = l.organization_id,
    client_id = l.client_id,
    opportunity_id = l.primary_opportunity_id
from public.leads l
where n.lead_id = l.id
  and (n.organization_id is null or n.client_id is null or n.opportunity_id is null);

update public.advisor_notes n
set author_profile_id = p.id
from public.profiles p
where p.legacy_staff_user_id = n.staff_user_id
  and n.author_profile_id is null;

update public.questionnaire_submissions q
set organization_id = l.organization_id,
    client_id = l.client_id,
    opportunity_id = l.primary_opportunity_id,
    brand_id = l.brand_id
from public.leads l
where q.lead_id = l.id
  and (q.organization_id is null or q.client_id is null
       or q.opportunity_id is null or q.brand_id is null);

update public.questionnaire_responses q
set opportunity_id = l.primary_opportunity_id
from public.leads l
where q.lead_id = l.id
  and q.opportunity_id is null;

update public.video_progress v
set organization_id = l.organization_id,
    client_id = l.client_id,
    opportunity_id = l.primary_opportunity_id,
    brand_id = l.brand_id
from public.leads l
where v.lead_id = l.id
  and (v.organization_id is null or v.client_id is null
       or v.opportunity_id is null or v.brand_id is null);

-- ---------------------------------------------------------------------------
-- 9. One FDD workflow per opportunity whose lead has FDD state. Values are
--    copied verbatim; leads.fdd_* remains the synchronized legacy mirror.
-- ---------------------------------------------------------------------------
insert into public.opportunity_fdd_workflows
  (organization_id, client_id, opportunity_id, brand_id, status,
   requested_at, sent_at, delivered_at, received_at, eligible_at,
   provider, provider_envelope_id, external_workflow_id, request_source,
   last_error, retry_count)
select l.organization_id,
       l.client_id,
       l.primary_opportunity_id,
       l.brand_id,
       l.fdd_status,
       l.fdd_requested_at,
       l.fdd_sent_at,
       l.fdd_delivered_at,
       l.fdd_received_at,
       l.fdd_eligible_at,
       case when l.fdd_provider_envelope_id is not null
              or l.fdd_workflow_id is not null
            then 'gohighlevel' end,
       l.fdd_provider_envelope_id,
       l.fdd_workflow_id,
       l.fdd_request_source,
       l.fdd_last_error,
       l.fdd_retry_count
from public.leads l
where l.fdd_status <> 'not_requested'
  and l.organization_id is not null
  and l.client_id is not null
  and l.primary_opportunity_id is not null
  and l.brand_id is not null
on conflict (opportunity_id) do nothing;

-- fdd_audit_log: additive links to the opportunity and workflow. lead_id and
-- all historical values are untouched (the log stays immutable).
update public.fdd_audit_log f
set organization_id = l.organization_id,
    opportunity_id = l.primary_opportunity_id
from public.leads l
where f.lead_id = l.id
  and (f.organization_id is null or f.opportunity_id is null);

update public.fdd_audit_log f
set fdd_workflow_id = w.id
from public.opportunity_fdd_workflows w
where w.opportunity_id = f.opportunity_id
  and f.fdd_workflow_id is null;

-- ---------------------------------------------------------------------------
-- 10. Copy portal_events into activity_events. legacy_portal_event_id makes
--     this rerunnable; portal_events itself remains operational and
--     untouched. occurred_at prefers the provider timestamp, falling back
--     to ingestion time.
-- ---------------------------------------------------------------------------
insert into public.activity_events
  (organization_id, client_id, lead_id, opportunity_id, actor_profile_id,
   event_type, event_source, event_data, page_url, legacy_portal_event_id,
   occurred_at, created_at)
select l.organization_id,
       l.client_id,
       l.id,
       l.primary_opportunity_id,
       p.id,
       e.event_name,
       e.event_source,
       coalesce(e.event_data, '{}'::jsonb),
       e.page_url,
       e.id,
       coalesce(e.occurred_at, e.created_at),
       e.created_at
from public.portal_events e
join public.leads l on l.id = e.lead_id
left join public.profiles p on p.legacy_staff_user_id = e.created_by_staff_user_id
where l.organization_id is not null
on conflict (legacy_portal_event_id) do nothing;
