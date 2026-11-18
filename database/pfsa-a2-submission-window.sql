-- A2 only: regular submissions open at midnight IST on 5 December 2026.
-- Existing batch dates, A1 access, student work and payment records are retained.
create or replace function public.pfsa_can_submit_a2(candidate_id uuid,at_time timestamptz default now())
returns boolean language sql stable set search_path='' as $$
 select exists(select 1 from public.pfsa_profiles p where p.id=candidate_id and (
  p.cohort is distinct from 'A2/2026' or at_time>='2026-12-05T00:00:00+05:30'::timestamptz or exists(
   select 1 from public.pfsa_start_selections s join public.pfsa_records r on r.id=s.payment_id
   where s.user_id=p.id and s.mode='early' and r.user_id=p.id and r.kind='payment'
   and r.data->>'programme'=s.programme and r.data->>'order_type'='early_start'
   and r.data->>'package'='bundle' and r.data->>'status' in ('pending','approved')
  )
 ));
$$;
revoke all on function public.pfsa_can_submit_a2(uuid,timestamptz) from public,anon;
grant execute on function public.pfsa_can_submit_a2(uuid,timestamptz) to authenticated;

do $migration$
declare definition text;original_policy text;
begin
 definition:=pg_get_functiondef('pfsa_private.enforce_learning_start()'::regprocedure);
 if position('A2/2026' in definition)=0 then
  execute replace(definition,'begin', $new$begin
   if exists(select 1 from public.pfsa_profiles p where p.id=new.user_id and p.cohort='A2/2026') and not public.pfsa_can_submit_a2(new.user_id) then
    raise exception 'A2/2026 submissions open on 5 December 2026 (IST). Choose Early Bird in Certification to submit before this date.' using errcode='42501';
   end if;
  $new$);
 end if;
 definition:=pg_get_functiondef('public.pfsa_ensure_programme_notice()'::regprocedure);
 if position('pfsa_can_submit_a2' in definition)=0 then
  execute replace(definition,'if s.start_at<=now() then', $new$if not public.pfsa_can_submit_a2(uid) then return null;end if;
   if s.start_at<=now() then$new$);
 end if;
 definition:=pg_get_functiondef('pfsa_private.choose_start(text,boolean,text,text)'::regprocedure);
 if position('2026-12-05' in definition)=0 then
  execute replace(definition,'if now()>=starts then', $new$if (p.cohort='A2/2026' and now()>='2026-12-05T00:00:00+05:30'::timestamptz) or now()>=starts then$new$);
 end if;
 select qual into original_policy from pg_policies where schemaname='public' and tablename='pfsa_notifications' and policyname='pfsa_notification_read';
 if position('pfsa-a2-submission-window-v1' in original_policy)=0 then
  execute 'alter policy pfsa_notification_read on public.pfsa_notifications using (('||original_policy||') and (
   (select auth.jwt()->''app_metadata''->>''pfsa_role'')=''admin'' or
   not exists(select 1 from public.pfsa_profiles p where p.id=(select auth.uid()) and p.cohort=''A2/2026'') or (
    id<>''604cf1bc-5f70-4d86-b4df-e2c666e3d907''::uuid
    and (category<>''programme_start'' or public.pfsa_can_submit_a2((select auth.uid())))
    and (system_key is distinct from ''pfsa-a2-submission-window-v1'' or (now()<''2026-12-05T00:00:00+05:30''::timestamptz and not public.pfsa_can_submit_a2((select auth.uid()))))
   )
  ))';
 end if;
end $migration$;

create or replace function public.pfsa_start_options() returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('version','start-choice-v1','batch',p.cohort,
  'start_at',coalesce(p.start_date,date '2026-11-17')::timestamp at time zone 'Asia/Kolkata',
  'submission_at',case when p.cohort='A2/2026' then '2026-12-05T00:00:00+05:30'::timestamptz else coalesce(p.start_date,date '2026-11-17')::timestamp at time zone 'Asia/Kolkata' end,
  'early_available',now()<case when p.cohort='A2/2026' then '2026-12-05T00:00:00+05:30'::timestamptz else coalesce(p.start_date,date '2026-11-17')::timestamp at time zone 'Asia/Kolkata' end,'early_price',400)
 from public.pfsa_profiles p where p.id=auth.uid();
$$;

create or replace function pfsa_private.upgrade_a2_early_start(terms_accepted boolean,transaction_reference text,screenshot_path text default '')
returns public.pfsa_start_selections language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();p public.pfsa_profiles;s public.pfsa_start_selections;payment uuid;
begin
 if uid is null then raise exception 'Sign in to choose Early Bird.' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 select * into p from public.pfsa_profiles where id=uid;
 if p.cohort is distinct from 'A2/2026' then raise exception 'This Early Bird upgrade is only for A2/2026.' using errcode='42501';end if;
 if now()>='2026-12-05T00:00:00+05:30'::timestamptz then raise exception 'A2 regular submissions are already open. Early Bird is no longer required.';end if;
 select * into s from public.pfsa_start_selections where user_id=uid;
 if s.user_id is null or p.name_confirmed_at is null then raise exception 'Confirm your name, domain and start option first.';end if;
 if not exists(select 1 from public.pfsa_records a where a.user_id=uid and a.kind='application' and a.data->>'programme'=s.programme and a.data->>'status'='approved') then raise exception 'An active internship is required.';end if;
 if s.mode='early' and s.payment_id is not null then return s;end if;
 if exists(select 1 from public.pfsa_records r where r.user_id=uid and r.kind='payment') then raise exception 'An order is already recorded. Do not pay again; contact Support.';end if;
 if terms_accepted is distinct from true then raise exception 'Accept the Early Bird and document review terms.';end if;
 if not public.pfsa_valid_payment_reference(transaction_reference) then raise exception 'Enter your UTR / Payment ID.';end if;
 if screenshot_path<>'' and split_part(screenshot_path,'/',1)<>uid::text then raise exception 'Upload your own screenshot.';end if;
 update public.pfsa_start_selections set mode='early',terms_version='PFSA-A2-EARLY-2026-11-18',accepted_at=now() where user_id=uid;
 insert into public.pfsa_records(kind,user_id,data) values('payment',uid,jsonb_build_object('programme',s.programme,'package','bundle','order_type','early_start','amount',400,'price_version',public.pfsa_pricing_version(),'status','pending','utr',btrim(transaction_reference),'path',screenshot_path,'terms_accepted',1,'terms_version','PFSA-DOCUMENTS-2026-11-12','start_terms_version','PFSA-A2-EARLY-2026-11-18')) returning id into payment;
 update public.pfsa_start_selections set payment_id=payment where user_id=uid;
 update public.pfsa_records set data=data||jsonb_build_object('start_mode','early','start_terms_accepted_at',now()) where user_id=uid and kind='application';
 select * into s from public.pfsa_start_selections where user_id=uid;return s;
end $$;
revoke all on function pfsa_private.upgrade_a2_early_start(boolean,text,text) from public,anon,authenticated;
create or replace function public.pfsa_upgrade_a2_early_start(terms_accepted boolean,transaction_reference text,screenshot_path text default '')
returns public.pfsa_start_selections language sql security definer set search_path='' as $$
 select pfsa_private.upgrade_a2_early_start(terms_accepted,transaction_reference,screenshot_path);
$$;
revoke all on function public.pfsa_upgrade_a2_early_start(boolean,text,text) from public,anon;
grant execute on function public.pfsa_upgrade_a2_early_start(boolean,text,text) to authenticated;

insert into public.pfsa_notifications(category,title,body,audience,target_batch,created_by,system_key)
values('announcement','A2/2026: submissions open on 5 December 2026',
 'Your A2/2026 regular task submissions open on 5 December 2026 at 12:00 AM IST. You can view your offer letter and learning resources while you wait. Want to submit sooner? Choose the ₹400 Early Bird bundle in Certification. Submit your UTR / Payment ID to open early submission access; payment remains subject to staff verification. The bundle includes your Certificate of Experience and Letter of Recommendation after all four weekly submissions and payment approval. If an order is already recorded, do not pay again.',
 'batch','A2/2026',null,'pfsa-a2-submission-window-v1') on conflict(system_key) do nothing;
