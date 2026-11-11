-- Run only in PFSA project rxiqubmkzqvspnzdasiz SQL Editor.
BEGIN;
create table if not exists public.pfsa_batches (
 id uuid primary key default gen_random_uuid(),
 name text not null unique check(length(btrim(name))>0),
 start_date date not null,
 end_date date not null,
 created_at timestamptz not null default now(),
 check(end_date>=start_date)
);
alter table public.pfsa_batches enable row level security;
grant select,insert,update,delete on public.pfsa_batches to authenticated;
drop policy if exists pfsa_batch_read on public.pfsa_batches;
create policy pfsa_batch_read on public.pfsa_batches for select to authenticated using(true);
drop policy if exists pfsa_batch_staff on public.pfsa_batches;
create policy pfsa_batch_staff on public.pfsa_batches for all to authenticated
using((select auth.jwt()->'app_metadata'->>'pfsa_role')='admin')
with check((select auth.jwt()->'app_metadata'->>'pfsa_role')='admin');
insert into public.pfsa_batches(name,start_date,end_date) values('Batch 1','2026-11-17','2026-12-14') on conflict(name) do nothing;
-- Preserve explicit cohort assignments. Map only the previous default cohort.
update public.pfsa_profiles set cohort='Batch 1',start_date='2026-11-17'
where coalesce(cohort,'') in ('','Next available batch') and exists(select 1 from public.pfsa_records a where a.kind='application' and a.user_id=pfsa_profiles.id);
drop policy if exists pfsa_profile_create on public.pfsa_profiles;
create policy pfsa_profile_create on public.pfsa_profiles for insert to authenticated
with check(id=(select auth.uid()) or (select auth.jwt()->'app_metadata'->>'pfsa_role')='admin');
-- Staff-only roster includes registered accounts even before profile completion.
create or replace function public.pfsa_admin_students()
returns table(id uuid,name text,email text,phone text,city text,linkedin text,github text,cohort text,start_date date,created_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or coalesce(auth.jwt()->'app_metadata'->>'pfsa_role','')<>'admin' then raise exception 'Staff access required.' using errcode='42501';end if;
 return query select u.id,coalesce(p.name,u.raw_user_meta_data->>'name',u.email::text,'Student'),u.email::text,coalesce(p.phone,''),coalesce(p.city,''),coalesce(p.linkedin,''),coalesce(p.github,''),coalesce(p.cohort,''),p.start_date,u.created_at
 from auth.users u left join public.pfsa_profiles p on p.id=u.id
 where coalesce(u.raw_app_meta_data->>'pfsa_role','')<>'admin' and u.deleted_at is null
 order by u.created_at desc,u.id;
end $$;
revoke all on function public.pfsa_admin_students() from public,anon;
grant execute on function public.pfsa_admin_students() to authenticated;
-- Activate precisely the account requested by the owner; no password is stored here.
do $$begin
 if not exists(select 1 from auth.users where id='82b0c1fd-6066-4243-a782-c3f6d3c6608e' and email='admin@skillsetgoedutech.in') then raise exception 'Expected PFSA admin account was not found.';end if;
 update auth.users set raw_app_meta_data=coalesce(raw_app_meta_data,'{}'::jsonb)||'{"pfsa_role":"admin"}'::jsonb,email_confirmed_at=coalesce(email_confirmed_at,now()),updated_at=now() where id='82b0c1fd-6066-4243-a782-c3f6d3c6608e' and email='admin@skillsetgoedutech.in';
 insert into public.pfsa_profiles(id,name,email) values('82b0c1fd-6066-4243-a782-c3f6d3c6608e','PFSA Administrator','admin@skillsetgoedutech.in') on conflict(id) do nothing;
end $$;
COMMIT;
select 'PFSA admin dashboard ready' as result;
