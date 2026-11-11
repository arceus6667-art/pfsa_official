-- PFSA application schema; additive and isolated from other applications.
create table if not exists public.pfsa_profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 name text not null, email text not null, phone text default '', city text default '',
 linkedin text default '', github text default '', cohort text default '', start_date date,
 created_at timestamptz not null default now()
);
create table if not exists public.pfsa_records (
 id uuid primary key default gen_random_uuid(),
 kind text not null check(kind in ('application','submission','resource','task','payment','document','support')),
 user_id uuid references auth.users(id) on delete cascade,
 data jsonb not null default '{}', created_at timestamptz not null default now()
);
create unique index if not exists pfsa_one_application on public.pfsa_records(user_id) where kind='application';
create unique index if not exists pfsa_unique_week on public.pfsa_records(user_id,(data->>'programme'),(data->>'week')) where kind='submission';
create index if not exists pfsa_records_owner on public.pfsa_records(user_id,kind);
alter table public.pfsa_profiles enable row level security;
alter table public.pfsa_records enable row level security;
grant select,insert,update,delete on public.pfsa_profiles,public.pfsa_records to authenticated;
create policy pfsa_profile_read on public.pfsa_profiles for select to authenticated using(id=(select auth.uid()) or (select auth.jwt()->'app_metadata'->>'pfsa_role')='admin');
create policy pfsa_profile_create on public.pfsa_profiles for insert to authenticated with check(id=(select auth.uid()));
create policy pfsa_profile_edit on public.pfsa_profiles for update to authenticated using(id=(select auth.uid()) or (select auth.jwt()->'app_metadata'->>'pfsa_role')='admin') with check(id=(select auth.uid()) or (select auth.jwt()->'app_metadata'->>'pfsa_role')='admin');
create policy pfsa_record_read on public.pfsa_records for select to authenticated using(user_id=(select auth.uid()) or (select auth.jwt()->'app_metadata'->>'pfsa_role')='admin' or (kind in ('resource','task') and exists(select 1 from public.pfsa_records a where a.kind='application' and a.user_id=(select auth.uid()) and a.data->>'programme'=pfsa_records.data->>'programme')));
-- Resource/task reads use an application lookup; avoid a recursive RLS self-query by
-- granting these teaching materials to authenticated learners instead.
drop policy pfsa_record_read on public.pfsa_records;
create policy pfsa_record_read on public.pfsa_records for select to authenticated using(user_id=(select auth.uid()) or kind in ('resource','task') or (select auth.jwt()->'app_metadata'->>'pfsa_role')='admin');
create policy pfsa_record_create on public.pfsa_records for insert to authenticated with check(
 (select auth.jwt()->'app_metadata'->>'pfsa_role')='admin' or
 (user_id=(select auth.uid()) and (
 (kind='application' and data->>'status'='pending') or
 (kind='submission' and data->>'status'='submitted' and not(data ? 'marks') and (data->>'week')::int between 1 and 4 and cardinality(regexp_split_to_array(trim(data->>'description'),'\s+'))>=200) or
 (kind='payment' and data->>'status'='pending' and data->>'package' in ('150','199','600')) or
 (kind='support' and data->>'status'='open')
 )));
create policy pfsa_record_admin_update on public.pfsa_records for update to authenticated using((select auth.jwt()->'app_metadata'->>'pfsa_role')='admin') with check((select auth.jwt()->'app_metadata'->>'pfsa_role')='admin');
create policy pfsa_record_admin_delete on public.pfsa_records for delete to authenticated using((select auth.jwt()->'app_metadata'->>'pfsa_role')='admin');
create function public.pfsa_validate_record() returns trigger language plpgsql security invoker set search_path='' as $$
declare total integer;
begin
 if new.kind='submission' then
  if not exists(select 1 from public.pfsa_records a where a.kind='application' and a.user_id=new.user_id and a.data->>'programme'=new.data->>'programme' and a.data->>'status'='approved') then raise exception 'An approved internship application is required.'; end if;
  if not exists(select 1 from public.pfsa_records t where t.kind='task' and t.data->>'programme'=new.data->>'programme' and t.data->>'week'=new.data->>'week') then raise exception 'The academy has not published this task.'; end if;
  if new.data ? 'marks' and ((new.data->>'marks')::numeric<0 or (new.data->>'marks')::numeric>100) then raise exception 'Marks must be between 0 and 100.'; end if;
 end if;
 if new.kind='payment' and TG_OP='INSERT' then
  select count(distinct data->>'week') into total from public.pfsa_records where kind='submission' and user_id=new.user_id;
  if total<>4 then raise exception 'Submit all four weekly projects before requesting completion documents.'; end if;
  if new.data->>'package'='600' and length(coalesce(new.data->>'address',''))<15 then raise exception 'Enter a complete Indian delivery address.'; end if;
 end if;
 if new.kind='document' and new.data->>'status'='published' and new.data->>'type'<>'Offer Letter' then
  select count(distinct data->>'week') into total from public.pfsa_records where kind='submission' and user_id=new.user_id and data->>'programme'=new.data->>'programme' and data->>'status'='reviewed';
  if total<>4 or not exists(select 1 from public.pfsa_records where kind='payment' and user_id=new.user_id and data->>'status'='approved') then raise exception 'Four reviewed projects and an approved payment are required.'; end if;
 end if;
 return new;
end $$;
revoke all on function public.pfsa_validate_record() from public;
create trigger pfsa_validate before insert or update on public.pfsa_records for each row execute function public.pfsa_validate_record();
insert into storage.buckets(id,name,public,file_size_limit) values('pfsa-files','pfsa-files',false,10485760) on conflict(id) do nothing;
create policy pfsa_upload on storage.objects for insert to authenticated with check(bucket_id='pfsa-files' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy pfsa_file_read on storage.objects for select to authenticated using(bucket_id='pfsa-files' and ((storage.foldername(name))[1]=(select auth.uid())::text or (select auth.jwt()->'app_metadata'->>'pfsa_role')='admin' or exists(select 1 from public.pfsa_records r where r.kind in ('resource','task') and r.data->>'path'=name)));
create policy pfsa_file_delete on storage.objects for delete to authenticated using(bucket_id='pfsa-files' and ((storage.foldername(name))[1]=(select auth.uid())::text or (select auth.jwt()->'app_metadata'->>'pfsa_role')='admin'));
-- Public verification uses a separate projection containing no private file paths.
create table public.pfsa_public_documents(id uuid primary key,number text unique not null,type text not null,candidate text not null,issued_at timestamptz not null);
alter table public.pfsa_public_documents enable row level security;
grant select on public.pfsa_public_documents to anon,authenticated;
grant insert,update,delete on public.pfsa_public_documents to authenticated;
create policy pfsa_verification_read on public.pfsa_public_documents for select to anon,authenticated using(true);
create policy pfsa_verification_staff on public.pfsa_public_documents for all to authenticated using((select auth.jwt()->'app_metadata'->>'pfsa_role')='admin') with check((select auth.jwt()->'app_metadata'->>'pfsa_role')='admin');
create function public.pfsa_verify(document_number text) returns table(number text,type text,candidate text,issued_at timestamptz) language sql stable security invoker set search_path='' as $$ select number,type,candidate,issued_at from public.pfsa_public_documents where number=document_number limit 1; $$;
revoke all on function public.pfsa_verify(text) from public;
grant execute on function public.pfsa_verify(text) to anon,authenticated;
create function public.pfsa_sync_verification() returns trigger language plpgsql security invoker set search_path='' as $$ begin
if TG_OP='DELETE' then delete from public.pfsa_public_documents where id=old.id;return old;end if;
if new.kind='document' then
 delete from public.pfsa_public_documents where id=new.id;
 if new.data->>'status'='published' then insert into public.pfsa_public_documents values(new.id,new.data->>'number',new.data->>'type',new.data->>'candidate',new.created_at);end if;
end if;return new;end $$;
revoke all on function public.pfsa_sync_verification() from public;
create trigger pfsa_sync_verification after insert or update or delete on public.pfsa_records for each row execute function public.pfsa_sync_verification();
alter publication supabase_realtime add table public.pfsa_records,public.pfsa_profiles;
