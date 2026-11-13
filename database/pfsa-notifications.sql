create table public.pfsa_notifications (
 id uuid primary key default gen_random_uuid(),
 category text not null default 'announcement' check(category in ('announcement','programme_start')),
 title text not null check(char_length(btrim(title)) between 1 and 160),
 body text not null check(char_length(btrim(body)) between 1 and 3000),
 audience text not null default 'all' check(audience in ('all','domain','batch','student')),
 target_programme text,target_batch text,target_user uuid references auth.users(id) on delete cascade,
 published boolean not null default true,created_by uuid default auth.uid() references auth.users(id),
 created_at timestamptz not null default now(),
 system_key text unique,start_stage text check(start_stage in ('early','official')),programme_start_at timestamptz,
 check(audience<>'domain' or (target_programme is not null and target_programme in ('computer-cyber','mobile','network','cloud','database','iot'))),
 check(audience<>'batch' or nullif(btrim(target_batch),'') is not null),
 check(audience<>'student' or target_user is not null),
 check(category<>'programme_start' or (audience='student' and target_programme is not null and system_key is not null and start_stage is not null and programme_start_at is not null))
);
create index pfsa_notification_target_user on public.pfsa_notifications(target_user);
create index pfsa_notification_author on public.pfsa_notifications(created_by);
create index pfsa_notification_published on public.pfsa_notifications(created_at desc) where published;
alter table public.pfsa_notifications enable row level security;
revoke all on public.pfsa_notifications from anon,authenticated;
grant select,insert,update on public.pfsa_notifications to authenticated;
grant all on public.pfsa_notifications to service_role;
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
create policy pfsa_notification_staff_create on public.pfsa_notifications for insert to authenticated with check(
 (select auth.jwt()->'app_metadata'->>'pfsa_role')='admin' and category='announcement' and created_by=(select auth.uid()) and system_key is null
);
create policy pfsa_notification_staff_update on public.pfsa_notifications for update to authenticated using(
 (select auth.jwt()->'app_metadata'->>'pfsa_role')='admin' and category='announcement'
) with check((select auth.jwt()->'app_metadata'->>'pfsa_role')='admin' and category='announcement' and system_key is null);

create table public.pfsa_notification_receipts (
 notification_id uuid not null references public.pfsa_notifications(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 read_at timestamptz,dismissed_at timestamptz,primary key(notification_id,user_id)
);
create index pfsa_notification_receipt_owner on public.pfsa_notification_receipts(user_id);
alter table public.pfsa_notification_receipts enable row level security;
revoke all on public.pfsa_notification_receipts from anon,authenticated;
grant select,insert,update on public.pfsa_notification_receipts to authenticated;
grant all on public.pfsa_notification_receipts to service_role;
create policy pfsa_notification_receipt_read on public.pfsa_notification_receipts for select to authenticated using(user_id=(select auth.uid()));
create policy pfsa_notification_receipt_create on public.pfsa_notification_receipts for insert to authenticated with check(user_id=(select auth.uid()) and exists(select 1 from public.pfsa_notifications n where n.id=notification_id));
create policy pfsa_notification_receipt_update on public.pfsa_notification_receipts for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()) and exists(select 1 from public.pfsa_notifications n where n.id=notification_id));

create function public.pfsa_ensure_programme_notice() returns uuid language plpgsql security definer set search_path='' as $$
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
revoke all on function public.pfsa_ensure_programme_notice() from public,anon;
grant execute on function public.pfsa_ensure_programme_notice() to authenticated;
create function public.pfsa_notification_action(notice uuid,dismiss boolean default false) returns void language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in to update notifications.';end if;
 insert into public.pfsa_notification_receipts(notification_id,user_id,read_at,dismissed_at)
 select n.id,auth.uid(),now(),case when dismiss then now() else null end from public.pfsa_notifications n where n.id=notice
 on conflict(notification_id,user_id) do update set read_at=coalesce(pfsa_notification_receipts.read_at,excluded.read_at),dismissed_at=coalesce(excluded.dismissed_at,pfsa_notification_receipts.dismissed_at);
 if not found then raise exception 'Notification not available.';end if;
end $$;
revoke all on function public.pfsa_notification_action(uuid,boolean) from public,anon;
grant execute on function public.pfsa_notification_action(uuid,boolean) to authenticated;
create function public.pfsa_mark_notifications_read() returns void language sql security invoker set search_path='' as $$
 insert into public.pfsa_notification_receipts(notification_id,user_id,read_at)
 select n.id,auth.uid(),now() from public.pfsa_notifications n
 on conflict(notification_id,user_id) do update set read_at=coalesce(pfsa_notification_receipts.read_at,excluded.read_at)
$$;
revoke all on function public.pfsa_mark_notifications_read() from public,anon;
grant execute on function public.pfsa_mark_notifications_read() to authenticated;
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  alter publication supabase_realtime add table public.pfsa_notifications,public.pfsa_notification_receipts;
 end if;
end $$;
