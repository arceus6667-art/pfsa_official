create or replace function pfsa_private.enforce_learning_start() returns trigger language plpgsql set search_path='' as $$
begin
 if not exists(select 1 from public.pfsa_start_selections s where s.user_id=new.user_id and s.programme=new.data->>'programme' and (s.mode='regular' or s.legacy_access or s.start_at<=now() or (s.mode='early' and s.payment_id is not null))) then
  raise exception 'Choose your start option and complete any required Early Start payment submission before submitting work.';
 end if;
 return new;
end $$;

drop policy pfsa_notification_read on public.pfsa_notifications;
create policy pfsa_notification_read on public.pfsa_notifications for select to authenticated using(
 (select auth.jwt()->'app_metadata'->>'pfsa_role')='admin' or (
 published and (
  (category='announcement' and (
   audience='all' or (audience='student' and target_user=(select auth.uid())) or
   (audience='domain' and exists(select 1 from public.pfsa_records a where a.kind='application' and a.user_id=(select auth.uid()) and a.data->>'status'='approved' and a.data->>'programme'=target_programme)) or
   (audience='batch' and exists(select 1 from public.pfsa_profiles p where p.id=(select auth.uid()) and p.cohort=target_batch))
  )) or
  (category='programme_start' and target_user=(select auth.uid()) and exists(
   select 1 from public.pfsa_start_selections s join public.pfsa_records a on a.kind='application' and a.user_id=s.user_id and a.data->>'programme'=s.programme and a.data->>'status'='approved'
   where s.user_id=(select auth.uid()) and s.programme=target_programme and s.start_at=programme_start_at and
   ((start_stage='official' and s.start_at<=now()) or (start_stage='early' and s.start_at>now() and (s.mode='regular' or s.legacy_access or (s.mode='early' and s.payment_id is not null))))
  ))
 ))
);

create or replace function public.pfsa_ensure_programme_notice() returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();s public.pfsa_start_selections;stage text;key text;notice uuid;heading text;message text;
begin
 if uid is null then raise exception 'Sign in to view notifications.' using errcode='42501';end if;
 if auth.jwt()->'app_metadata'->>'pfsa_role'='admin' then return null;end if;
 select ss.* into s from public.pfsa_start_selections ss join public.pfsa_records a on a.kind='application' and a.user_id=ss.user_id and a.data->>'programme'=ss.programme and a.data->>'status'='approved' where ss.user_id=uid;
 if not found then return null;end if;
 if s.start_at<=now() then
  stage:='official';heading:='Your programme has officially started';
  message:='Your programme has officially started. You can now submit your weekly tasks from the Tasks section. Please read the task briefs carefully and submit your project work with the required description. Follow the deadlines in your Schedule, and contact Support if you need assistance. Welcome aboard!';
 elsif s.mode='regular' or s.legacy_access or (s.mode='early' and s.payment_id is not null) then
  stage:='early';heading:='Your learning access is open';
  message:='Your internship workspace is open, and you can submit your weekly tasks now. Read the task briefs in Tasks, use your domain resources, and contact Support if you need assistance. Your regular batch start date remains unchanged.';
 else return null;end if;
 key:=uid::text||':'||s.programme||':'||stage||':'||s.start_at::text;
 insert into public.pfsa_notifications(category,title,body,audience,target_programme,target_user,created_by,system_key,start_stage,programme_start_at)
 values('programme_start',heading,message,'student',s.programme,uid,null,key,stage,s.start_at) on conflict(system_key) do nothing returning id into notice;
 if notice is null then select id into notice from public.pfsa_notifications where system_key=key;end if;
 return notice;
end $$;
