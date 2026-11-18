begin;
do $test$
declare domain text;batch text;student uuid;choice public.pfsa_start_selections;again public.pfsa_start_selections;blocked boolean;checks integer:=0;
begin
 foreach domain in array array['computer-cyber','mobile','network','cloud','database','iot'] loop
  foreach batch in array array['A1/2026','A2/2026'] loop
   student:=gen_random_uuid();
   insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values(student,'authenticated','authenticated','a2-test-'||student::text||'@example.invalid','{}','{"name":"Disposable A2 QA"}',now(),now());
   insert into public.pfsa_profiles(id,name,email,name_confirmed_at,cohort,start_date) values(student,'Disposable A2 QA','a2-test-'||student::text||'@example.invalid',now(),batch,date '2026-12-15');
   perform set_config('request.jwt.claims',jsonb_build_object('sub',student,'role','authenticated','email','a2-test-'||student::text||'@example.invalid','app_metadata','{}'::jsonb)::text,true);
   set local role authenticated;
   insert into public.pfsa_records(kind,user_id,data) values('application',student,jsonb_build_object('programme',domain,'status','pending'));
   select * into choice from public.pfsa_choose_start('regular',true,'','');
   if batch='A2/2026' then
    if public.pfsa_can_submit_a2(student,'2026-12-04T23:59:59.999+05:30') then raise exception 'A2 opened early';end if;
    if not public.pfsa_can_submit_a2(student,'2026-12-05T00:00:00+05:30') then raise exception 'A2 midnight release failed';end if;
    if public.pfsa_ensure_programme_notice() is not null then raise exception 'A2 regular received submit-now notice';end if;
    if exists(select 1 from public.pfsa_notifications where id='604cf1bc-5f70-4d86-b4df-e2c666e3d907') then raise exception 'Old global notice visible to A2';end if;
    if not exists(select 1 from public.pfsa_notifications where system_key='pfsa-a2-submission-window-v1') then raise exception 'A2 schedule notice missing';end if;
    blocked:=false;
    begin insert into public.pfsa_records(kind,user_id,data) values('submission',student,jsonb_build_object('programme',domain,'week',1,'description','','status','submitted'));exception when insufficient_privilege then if position('A2/2026 submissions open' in sqlerrm)>0 then blocked:=true;else raise;end if;end;
    if not blocked then raise exception 'A2 server accepted a locked submission';end if;
    blocked:=false;
    begin perform public.pfsa_upgrade_a2_early_start(false,'QA-FAKE-'||student::text,'');exception when others then blocked:=true;end;
    if not blocked then raise exception 'Terms not enforced';end if;
    select * into choice from public.pfsa_upgrade_a2_early_start(true,'QA-FAKE-'||student::text,'');
    if choice.mode<>'early' or choice.payment_id is null then raise exception 'A2 upgrade failed';end if;
    if not public.pfsa_can_submit_a2(student) then raise exception 'Early access did not open';end if;
    if not exists(select 1 from public.pfsa_records where id=choice.payment_id and data->>'status'='pending' and data->>'amount'='400') then raise exception 'Early payment auto approved or wrongly priced';end if;
    if exists(select 1 from public.pfsa_notifications where system_key='pfsa-a2-submission-window-v1') then raise exception 'Waiting notice remained after Early Bird';end if;
    perform public.pfsa_ensure_programme_notice();
    if not exists(select 1 from public.pfsa_notifications where category='programme_start' and target_user=student) then raise exception 'Paid early notice missing';end if;
    select * into again from public.pfsa_upgrade_a2_early_start(true,'QA-RETRY','');
    if again.payment_id<>choice.payment_id or (select count(*) from public.pfsa_records where user_id=student and kind='payment')<>1 then raise exception 'Duplicate upgrade order';end if;
   else
    if not public.pfsa_can_submit_a2(student,'2026-11-01T00:00:00+05:30') then raise exception 'A1 access changed';end if;
    if not exists(select 1 from public.pfsa_notifications where id='604cf1bc-5f70-4d86-b4df-e2c666e3d907') then raise exception 'A1 announcement hidden';end if;
    blocked:=false;
    begin perform public.pfsa_upgrade_a2_early_start(true,'QA-A1','');exception when insufficient_privilege then blocked:=true;end;
    if not blocked then raise exception 'A1 could use A2 upgrade';end if;
   end if;
   insert into public.pfsa_records(kind,user_id,data) values('submission',student,jsonb_build_object('programme',domain,'week',1,'description','','status','submitted'));
   if not exists(select 1 from public.pfsa_records where kind='submission' and user_id=student) then raise exception 'Eligible submission failed';end if;
   if (select cohort from public.pfsa_profiles where id=student)<>batch or choice.start_at<>'2026-12-15T00:00:00+05:30'::timestamptz then raise exception 'Batch assignment changed';end if;
   reset role;checks:=checks+1;
  end loop;
 end loop;
 if checks<>12 then raise exception 'Missing test journeys';end if;
end $test$;
rollback;
select 'PASS: six domains; A2 server lock, exact IST release, notification isolation, optional screenshot, accepted terms, ₹400 pending upgrade and idempotent retry; A1 access/notice preserved and A2 upgrade denied. All fixtures rolled back.' result;
