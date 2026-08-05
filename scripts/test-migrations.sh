#!/usr/bin/env bash
# Migration test harness: applies every Supabase migration to a throwaway
# local PostgreSQL cluster, seeds representative legacy data between 0004 and
# 0005, applies the platform-domain migrations TWICE (rerun safety), and
# asserts the backfill invariants.
#
# Requires: postgresql (initdb, pg_ctl, psql) on PATH or in
# /usr/lib/postgresql/*/bin. Creates everything under a temp dir; never
# touches a real database.
#
#   ./scripts/test-migrations.sh
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
MIGRATIONS_DIR="$REPO_DIR/supabase/migrations"

PGBIN="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1 || true)"
if [ -z "$PGBIN" ]; then PGBIN="$(dirname "$(command -v initdb)")"; fi
export PATH="$PGBIN:$PATH"

WORKDIR="$(mktemp -d)"
export PGDATA="$WORKDIR/data"
export PGHOST="$WORKDIR"
export PGPORT=54329
export PGUSER=postgres
export PGDATABASE=postgres
LOG="$WORKDIR/pg.log"

cleanup() {
  pg_ctl -D "$PGDATA" stop -m immediate >/dev/null 2>&1 || true
  rm -rf "$WORKDIR"
}
trap cleanup EXIT

echo "==> Initializing throwaway cluster in $WORKDIR"
initdb -U postgres -D "$PGDATA" --auth=trust >/dev/null
pg_ctl -D "$PGDATA" -l "$LOG" -o "-p $PGPORT -k $WORKDIR -c listen_addresses=''" start >/dev/null

run_sql() { psql -v ON_ERROR_STOP=1 -q -c "$1"; }
run_file() { psql -v ON_ERROR_STOP=1 -q -f "$1"; }
scalar() { psql -tA -v ON_ERROR_STOP=1 -c "$1"; }

assert_eq() { # assert_eq <label> <expected> <actual>
  if [ "$2" != "$3" ]; then
    echo "FAIL: $1 — expected [$2], got [$3]"
    exit 1
  fi
  echo "  ok: $1 = $2"
}

echo "==> Stubbing Supabase-specific objects (auth/storage schemas, roles)"
run_sql "create schema if not exists auth;
         create or replace function auth.uid() returns uuid
           language sql stable as 'select null::uuid';
         create schema if not exists storage;
         create table if not exists storage.buckets
           (id text primary key, name text, public boolean);
         do \$\$ begin
           if not exists (select from pg_roles where rolname = 'authenticated') then
             create role authenticated nologin;
           end if;
           if not exists (select from pg_roles where rolname = 'anon') then
             create role anon nologin;
           end if;
         end \$\$;"

echo "==> Applying legacy migrations 0001–0005 (incl. Territory Advisor)"
for f in "$MIGRATIONS_DIR"/0001_*.sql "$MIGRATIONS_DIR"/0002_*.sql \
         "$MIGRATIONS_DIR"/0003_*.sql "$MIGRATIONS_DIR"/0004_*.sql \
         "$MIGRATIONS_DIR"/0005_*.sql; do
  echo "    $(basename "$f")"; run_file "$f"
done

echo "==> Seeding representative legacy data"
run_sql "
insert into public.staff_users (id, first_name, last_name, email, password_hash, role)
values
  ('11111111-1111-1111-1111-111111111111', 'Alex', 'Admin', 'admin@test.local', 'x', 'ADMIN'),
  ('22222222-2222-2222-2222-222222222222', 'Dana', 'Advisor', 'advisor@test.local', 'x', 'ADVISOR');

insert into public.leads
  (id, portal_token, first_name, last_name, email, phone, source, status,
   current_stage, assigned_advisor_id, qualification_score, qualification_result,
   qualification_reasons, last_activity_at,
   fdd_status, fdd_requested_at, fdd_sent_at, fdd_provider_envelope_id, fdd_retry_count)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'token-lead-1-0123456789abcdef',
   'Pat', 'Prospect', 'pat@test.local', '+15550000001', 'facebook', 'booked',
   'CONSULTATION_SCHEDULED', '22222222-2222-2222-2222-222222222222', 72, 'qualified',
   '[\"meets liquid capital\"]'::jsonb, now() - interval '1 day',
   'fdd_sent', now() - interval '2 days', now() - interval '2 days', 'env-123', 0),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'token-lead-2-0123456789abcdef',
   'Quinn', 'Unassigned', 'quinn@test.local', null, 'referral', 'created',
   'NEW_LEAD', null, null, null, null, null,
   'not_requested', null, null, null, 0);

insert into public.appointments (id, lead_id, advisor_id, external_appointment_id, status)
values ('bbbbbbbb-0000-0000-0000-000000000001',
        'aaaaaaaa-0000-0000-0000-000000000001',
        '22222222-2222-2222-2222-222222222222', 'ext-appt-1', 'SCHEDULED');

insert into public.advisor_notes (lead_id, staff_user_id, note)
values ('aaaaaaaa-0000-0000-0000-000000000001',
        '22222222-2222-2222-2222-222222222222', 'call went well');

insert into public.questionnaire_submissions (id, lead_id, questionnaire_version, submitted_at)
values ('cccccccc-0000-0000-0000-000000000001',
        'aaaaaaaa-0000-0000-0000-000000000001', 'v1', now() - interval '3 days');

insert into public.questionnaire_responses
  (lead_id, investment_timeline, liquid_capital, net_worth, business_ownership,
   primary_interest, remaining_questions, decision_criteria, decision_participants,
   accuracy_confirmed)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'immediately', '500k-999k',
        '2.5m-4.9m', 'yes-currently', 'growth', 'none', 'roi', 'independent', true);

insert into public.video_progress (lead_id, wistia_media_id, started, completed)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'media1', true, true);

insert into public.portal_events (lead_id, event_name, event_data, event_source)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'portal_opened', '{}'::jsonb, 'portal'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'fdd_requested', '{}'::jsonb, 'portal'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'lead_created', '{}'::jsonb, 'portal');

insert into public.fdd_audit_log (lead_id, event, source, actor, external_event_id)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'fdd_requested', 'portal', 'prospect', 'evt-1');

-- Pre-platform Territory Advisor activity (0005 seeded the cmdt brand).
insert into public.territory_searches
  (lead_id, brand_id, raw_query, result_status)
select 'aaaaaaaa-0000-0000-0000-000000000001', b.id, 'Dallas, TX', 'MANUAL_REVIEW'
from public.franchise_brands b where b.slug = 'cmdt';
insert into public.territory_review_requests (lead_id, brand_id)
select 'aaaaaaaa-0000-0000-0000-000000000001', b.id
from public.franchise_brands b where b.slug = 'cmdt';
"

echo "==> Applying 0006 + 0007 (first pass)"
run_file "$MIGRATIONS_DIR/0006_platform_domain.sql"
run_file "$MIGRATIONS_DIR/0007_platform_backfill.sql"

run_file "$MIGRATIONS_DIR/0008_zip_geographies.sql"

echo "==> Applying 0006 + 0007 + 0008 AGAIN (rerun safety)"
run_file "$MIGRATIONS_DIR/0006_platform_domain.sql"
run_file "$MIGRATIONS_DIR/0007_platform_backfill.sql"
run_file "$MIGRATIONS_DIR/0008_zip_geographies.sql"

echo "==> Asserting backfill invariants"
assert_eq "organizations (gendev, exactly one)" 1 \
  "$(scalar "select count(*) from organizations where slug='gendev'")"
assert_eq "cmdt brand exactly one, owned by gendev" 1 \
  "$(scalar "select count(*) from franchise_brands b
             join organizations o on o.id = b.organization_id
             where b.slug='cmdt' and o.slug='gendev'")"
assert_eq "profiles: one per staff user" 2 \
  "$(scalar "select count(*) from profiles where legacy_staff_user_id is not null")"
assert_eq "memberships: one per profile" 2 \
  "$(scalar "select count(*) from organization_memberships")"
assert_eq "admin role mapped" ORGANIZATION_ADMIN \
  "$(scalar "select m.role from organization_memberships m
             join profiles p on p.id = m.profile_id
             where p.email = 'admin@test.local'")"
assert_eq "clients: one per lead, no duplicates" 2 \
  "$(scalar "select count(*) from clients")"
assert_eq "opportunities: one per lead, no duplicates" 2 \
  "$(scalar "select count(*) from opportunities")"
assert_eq "every lead linked to client+opportunity+brand+org" 2 \
  "$(scalar "select count(*) from leads where client_id is not null
             and primary_opportunity_id is not null and brand_id is not null
             and organization_id is not null")"
assert_eq "stage copied onto opportunity" CONSULTATION_SCHEDULED \
  "$(scalar "select o.stage from opportunities o
             where o.source_lead_id = 'aaaaaaaa-0000-0000-0000-000000000001'")"
assert_eq "qualification copied" "72|qualified" \
  "$(scalar "select o.qualification_score || '|' || o.qualification_result
             from opportunities o
             where o.source_lead_id = 'aaaaaaaa-0000-0000-0000-000000000001'")"
assert_eq "advisor mapped to profile" advisor@test.local \
  "$(scalar "select p.email from opportunities o
             join profiles p on p.id = o.assigned_advisor_profile_id
             where o.source_lead_id = 'aaaaaaaa-0000-0000-0000-000000000001'")"
assert_eq "primary assignment mirrored" 1 \
  "$(scalar "select count(*) from opportunity_assignments where is_primary")"
assert_eq "appointment linked to opportunity" 1 \
  "$(scalar "select count(*) from appointments where opportunity_id is not null
             and client_id is not null and advisor_profile_id is not null")"
assert_eq "note linked + author profile" 1 \
  "$(scalar "select count(*) from advisor_notes where opportunity_id is not null
             and author_profile_id is not null")"
assert_eq "submission linked" 1 \
  "$(scalar "select count(*) from questionnaire_submissions
             where opportunity_id is not null and brand_id is not null")"
assert_eq "questionnaire response linked" 1 \
  "$(scalar "select count(*) from questionnaire_responses where opportunity_id is not null")"
assert_eq "video progress linked" 1 \
  "$(scalar "select count(*) from video_progress where opportunity_id is not null")"
assert_eq "FDD workflow: only for leads with FDD state" 1 \
  "$(scalar "select count(*) from opportunity_fdd_workflows")"
assert_eq "FDD workflow status copied" "fdd_sent|env-123" \
  "$(scalar "select status || '|' || provider_envelope_id from opportunity_fdd_workflows")"
assert_eq "lead FDD fields untouched" "fdd_sent|env-123" \
  "$(scalar "select fdd_status || '|' || fdd_provider_envelope_id from leads
             where id = 'aaaaaaaa-0000-0000-0000-000000000001'")"
assert_eq "audit log linked to opportunity+workflow" 1 \
  "$(scalar "select count(*) from fdd_audit_log where opportunity_id is not null
             and fdd_workflow_id is not null")"
assert_eq "activity events copied once (3 portal events)" 3 \
  "$(scalar "select count(*) from activity_events where legacy_portal_event_id is not null")"
assert_eq "portal_events untouched" 3 \
  "$(scalar "select count(*) from portal_events")"
assert_eq "portal tokens unchanged" "token-lead-1-0123456789abcdef" \
  "$(scalar "select portal_token from leads
             where id = 'aaaaaaaa-0000-0000-0000-000000000001'")"
assert_eq "RLS enabled on all new tables" 10 \
  "$(scalar "select count(*) from pg_class c
             join pg_namespace n on n.oid = c.relnamespace
             where n.nspname='public' and c.relrowsecurity
             and c.relname in ('organizations','profiles','organization_memberships',
               'clients','opportunities','opportunity_assignments',
               'external_record_mappings','integration_connections',
               'activity_events','opportunity_fdd_workflows')")"
assert_eq "territory rows linked to opportunity" "1|1" \
  "$(scalar "select
      (select count(*) from territory_searches where opportunity_id is not null) || '|' ||
      (select count(*) from territory_review_requests where opportunity_id is not null)")"

echo "==> Multi-opportunity smoke test (second brand, same client)"
run_sql "
insert into public.franchise_brands (slug, name, organization_id)
select 'second-brand', 'Second Brand', id from organizations where slug='gendev';
insert into public.opportunities (organization_id, client_id, brand_id, stage)
select c.organization_id, c.id, b.id, 'NEW_LEAD'
from clients c
join franchise_brands b on b.slug = 'second-brand'
where c.source_lead_id = 'aaaaaaaa-0000-0000-0000-000000000001';
insert into public.opportunity_fdd_workflows
  (organization_id, client_id, opportunity_id, brand_id, status)
select o.organization_id, o.client_id, o.id, o.brand_id, 'not_requested'
from opportunities o join franchise_brands b on b.id = o.brand_id
where b.slug = 'second-brand';
insert into public.territory_searches
  (lead_id, brand_id, raw_query, result_status, organization_id, client_id, opportunity_id)
select c.source_lead_id, o.brand_id, 'Austin, TX', 'MANUAL_REVIEW', o.organization_id, o.client_id, o.id
from opportunities o
join clients c on c.id = o.client_id
join franchise_brands b on b.id = o.brand_id
where b.slug = 'second-brand';
"
assert_eq "client has two opportunities across two brands" 2 \
  "$(scalar "select count(distinct o.brand_id) from opportunities o
             join clients c on c.id = o.client_id
             where c.source_lead_id = 'aaaaaaaa-0000-0000-0000-000000000001'")"
assert_eq "two FDD workflows, one per opportunity" 2 \
  "$(scalar "select count(*) from opportunity_fdd_workflows")"
assert_eq "territory search on correct opportunity" 1 \
  "$(scalar "select count(*) from territory_searches t
             join franchise_brands b on b.id = t.brand_id
             where b.slug='second-brand' and t.opportunity_id is not null")"

echo ""
echo "ALL MIGRATION TESTS PASSED"
