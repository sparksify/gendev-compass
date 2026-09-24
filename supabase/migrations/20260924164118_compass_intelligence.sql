-- Operational outbox only. All answers remain in existing Compass records.
alter table public.portal_events add column if not exists event_key text;
create unique index if not exists portal_events_lead_event_key on public.portal_events(lead_id,event_key);
alter table public.video_progress add column if not exists verified_watch jsonb not null default '{}';
alter table public.leads add column if not exists bridge_submission_key text unique;

create table if not exists public.compass_intelligence_sync (
 lead_id uuid primary key references public.leads(id) on delete cascade,
 event_key text not null,
 revision bigint not null default 1,
 synced_revision bigint not null default 0,
 attempts integer not null default 0,
 retry_count integer not null default 0,
 last_error text,
 next_attempt_at timestamptz not null default now(),
 lease_token uuid,
 lease_until timestamptz,
 external jsonb not null default '{}'
);
alter table public.compass_intelligence_sync enable row level security;
revoke all on public.compass_intelligence_sync from anon, authenticated;
grant all on public.compass_intelligence_sync to service_role;

create or replace function public.compass_enqueue(p_lead_id uuid, p_event_key text)
returns void language sql security invoker set search_path = public as $$
 insert into compass_intelligence_sync(lead_id,event_key) values(p_lead_id,p_event_key)
 on conflict(lead_id) do update set event_key=excluded.event_key,
 revision=compass_intelligence_sync.revision+1,
 next_attempt_at=case when compass_intelligence_sync.last_error is null then now() else compass_intelligence_sync.next_attempt_at end
 where compass_intelligence_sync.event_key is distinct from excluded.event_key;
$$;

create or replace function public.compass_source_changed()
returns trigger language plpgsql security invoker set search_path = public as $$
declare lid uuid; key text;
begin
 if tg_table_name='portal_events' then
   if new.event_name not in ('bridge_assessment_submitted','bridge_opened','portal_opened','questionnaire_submitted','appointment_booked','consultation_booked','consultation_rescheduled','consultation_cancelled','consultation_completed','consultation_no_show') then return new; end if;
   lid:=new.lead_id; key:='event:'||coalesce(new.event_key,new.id::text);
 elsif tg_table_name='video_progress' then
   if tg_op='UPDATE' and new.verified_watch=old.verified_watch then return new; end if;
   lid:=new.lead_id; key:='watch:'||md5(new.verified_watch::text);
 elsif tg_table_name='leads' then
   lid:=new.id;
   key:='lead:'||md5(jsonb_build_array(new.qualification_result,new.questionnaire_completed_at,new.booked_at,new.appointment_id)::text);
 elsif tg_table_name='questionnaire_answers' then
   select lead_id into lid from questionnaire_submissions where id=new.submission_id;
   key:='answer:'||new.id;
 else
   lid:=new.lead_id; key:=tg_table_name||':'||md5(to_jsonb(new)::text);
 end if;
 perform compass_enqueue(lid,key);
 return new;
end $$;

drop trigger if exists compass_event_outbox on public.portal_events;
create trigger compass_event_outbox after insert on public.portal_events for each row execute function public.compass_source_changed();
drop trigger if exists compass_video_outbox on public.video_progress;
create trigger compass_video_outbox after insert or update of verified_watch on public.video_progress for each row execute function public.compass_source_changed();
drop trigger if exists compass_lead_outbox on public.leads;
create trigger compass_lead_outbox after insert or update of qualification_result,questionnaire_completed_at,booked_at,appointment_id on public.leads for each row execute function public.compass_source_changed();
drop trigger if exists compass_questionnaire_outbox on public.questionnaire_responses;
create trigger compass_questionnaire_outbox after insert or update on public.questionnaire_responses for each row execute function public.compass_source_changed();
drop trigger if exists compass_answers_outbox on public.questionnaire_answers;
create trigger compass_answers_outbox after insert on public.questionnaire_answers for each row execute function public.compass_source_changed();
drop trigger if exists compass_appointment_outbox on public.appointments;
create trigger compass_appointment_outbox after insert or update on public.appointments for each row execute function public.compass_source_changed();

-- One worker per lead. Fencing token prevents an expired worker acknowledging
-- newer work. Claim only one at a time so leases do not expire in a batch queue.
create or replace function public.compass_claim()
returns setof public.compass_intelligence_sync language sql security invoker set search_path=public as $$
 update compass_intelligence_sync set lease_token=gen_random_uuid(), lease_until=now()+interval '10 minutes', attempts=attempts+1
 where lead_id=(select lead_id from compass_intelligence_sync
 where revision>synced_revision and next_attempt_at<=now() and (lease_until is null or lease_until<now())
 order by next_attempt_at for update skip locked limit 1)
 returning *;
$$;

-- Merge concurrent per-media reports without regressing already observed watch.
create or replace function public.compass_merge_watch()
returns trigger language plpgsql security invoker set search_path=public as $$
declare k text; v jsonb;
begin
 for k,v in select * from jsonb_each(old.verified_watch) loop
   if coalesce((new.verified_watch->k->>'percent')::numeric,-1) < (v->>'percent')::numeric then
     new.verified_watch:=jsonb_set(new.verified_watch,array[k],v);
   end if;
 end loop;
 return new;
end $$;
drop trigger if exists compass_merge_watch on public.video_progress;
create trigger compass_merge_watch before update of verified_watch on public.video_progress for each row execute function public.compass_merge_watch();
revoke all on function public.compass_merge_watch() from public,anon,authenticated;
grant execute on function public.compass_merge_watch() to service_role;

alter table public.questionnaire_submissions add column if not exists submission_key text unique;
-- Persist immutable questionnaire wording and answers atomically, so a worker
-- can never read a half-created snapshot.
create or replace function public.compass_save_submission(p_input jsonb)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare s questionnaire_submissions; result jsonb; inserted_id uuid;
begin
 insert into questionnaire_submissions(submission_key,lead_id,questionnaire_version,submitted_at,organization_id,client_id,opportunity_id,brand_id)
 values((p_input->>'lead_id')||':'||(p_input->>'questionnaire_version'),(p_input->>'lead_id')::uuid,p_input->>'questionnaire_version',(p_input->>'submitted_at')::timestamptz,
 (p_input->>'organization_id')::uuid,(p_input->>'client_id')::uuid,(p_input->>'opportunity_id')::uuid,(p_input->>'brand_id')::uuid) on conflict(submission_key) do nothing returning id into inserted_id;
 select * into s from questionnaire_submissions where submission_key=(p_input->>'lead_id')||':'||(p_input->>'questionnaire_version');
 if inserted_id is not null then
 insert into questionnaire_answers(submission_id,question_key,question_text,answer_value,answer_display_value)
 select s.id,a->>'question_key',a->>'question_text',a->>'answer_value',a->>'answer_display_value' from jsonb_array_elements(p_input->'answers') a;
 end if;
 select to_jsonb(s)||jsonb_build_object('answers',jsonb_agg(to_jsonb(a))) into result from questionnaire_answers a where a.submission_id=s.id;
 return result;
end $$;

revoke all on function public.compass_enqueue(uuid,text), public.compass_source_changed(), public.compass_claim(), public.compass_save_submission(jsonb) from public, anon, authenticated;
grant execute on function public.compass_enqueue(uuid,text), public.compass_source_changed(), public.compass_claim(), public.compass_save_submission(jsonb) to service_role;
