-- PFSA project rxiqubmkzqvspnzdasiz only. Preserves existing document IDs.
BEGIN;
alter table public.pfsa_profiles add column if not exists name_confirmed_at timestamptz;
update public.pfsa_batches set name='A1/2026' where name='Batch 1' and not exists(select 1 from public.pfsa_batches where name='A1/2026');
insert into public.pfsa_batches(name,start_date,end_date) values('A1/2026','2026-11-17','2026-12-14') on conflict(name) do nothing;
update public.pfsa_profiles set cohort='A1/2026',start_date='2026-11-17' where coalesce(cohort,'') in ('','Batch 1','Next available batch');
-- Existing password/email learners keep their current confirmed names.
update public.pfsa_profiles p set name_confirmed_at=now() from auth.users u where u.id=p.id and p.name_confirmed_at is null and coalesce(u.raw_app_meta_data->'providers','[]'::jsonb) ? 'email' and not(coalesce(u.raw_app_meta_data->'providers','[]'::jsonb) ? 'google');
create or replace function pfsa_private.protect_profile_identity() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if current_user not in ('postgres','supabase_admin') and coalesce(auth.jwt()->'app_metadata'->>'pfsa_role','')<>'admin' then
  if new.id is distinct from auth.uid() then raise exception 'Profile owner required.';end if;
  new.email=auth.jwt()->>'email';
  if TG_OP='INSERT' and new.name_confirmed_at is not null then raise exception 'Confirm your name using the onboarding form.';end if;
  if TG_OP='UPDATE' then
   if new.name_confirmed_at is distinct from old.name_confirmed_at then raise exception 'Name confirmation requires the onboarding form.';end if;
   if old.name_confirmed_at is not null and new.name is distinct from old.name then raise exception 'Contact academy staff to correct your document name.';end if;
  end if;
 end if;return new;
end $$;
revoke all on function pfsa_private.protect_profile_identity() from public;
drop trigger if exists pfsa_protect_profile on public.pfsa_profiles;
create trigger pfsa_protect_profile before insert or update on public.pfsa_profiles for each row execute function pfsa_private.protect_profile_identity();
create or replace function public.pfsa_confirm_name(full_name text) returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();official_email text;existing public.pfsa_profiles;clean text:=btrim(full_name);
begin
 if uid is null then raise exception 'Sign in first.' using errcode='42501';end if;
 if clean is null or char_length(clean)<2 or char_length(clean)>120 or clean ~ '[[:cntrl:]]' then raise exception 'Enter your full name using 2 to 120 characters on one line.';end if;
 select email into official_email from auth.users where id=uid;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,1));
 select * into existing from public.pfsa_profiles where id=uid for update;
 if existing.name_confirmed_at is not null then
  if existing.name is distinct from clean then raise exception 'Your document name is already confirmed. Contact staff for corrections.';end if;
  return;
 end if;
 insert into public.pfsa_profiles(id,name,email,name_confirmed_at,cohort,start_date) values(uid,clean,official_email,now(),'A1/2026','2026-11-17')
 on conflict(id) do update set name=excluded.name,email=excluded.email,name_confirmed_at=excluded.name_confirmed_at;
 -- A first-time confirmation corrects legacy auto-imported Google names without changing IDs.
 update public.pfsa_records set data=data||jsonb_build_object('candidate',clean) where user_id=uid and kind='document' and data->>'type'='Offer Letter' and data->>'generated'='1';
end $$;
revoke all on function public.pfsa_confirm_name(text) from public,anon;
grant execute on function public.pfsa_confirm_name(text) to authenticated;
create or replace function pfsa_private.prepare_application() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.kind='application' then
  if new.data->>'programme' not in ('computer-cyber','mobile','network','cloud','database','iot') then raise exception 'Choose a valid domain.';end if;
  if not exists(select 1 from public.pfsa_profiles where id=new.user_id and name_confirmed_at is not null) then raise exception 'Confirm your full name before enrolment.';end if;
  new.data=jsonb_build_object('programme',new.data->>'programme','status','approved','batch','A1/2026');
 end if;return new;
end $$;
create or replace function pfsa_private.issue_offer() returns trigger language plpgsql security definer set search_path='' as $$
declare candidate public.pfsa_profiles;batch_end date;number text;
begin
 if new.kind<>'application' then return new;end if;
 if auth.uid() is distinct from new.user_id and coalesce(auth.jwt()->'app_metadata'->>'pfsa_role','')<>'admin' then raise exception 'Application owner required.';end if;
 select * into candidate from public.pfsa_profiles where id=new.user_id;
 if candidate.name_confirmed_at is null then raise exception 'Confirm your full name before offer issuance.';end if;
 select end_date into batch_end from public.pfsa_batches where name=coalesce(nullif(candidate.cohort,''),'A1/2026');
 number='PFSA-OFFER-2026-'||upper(replace(gen_random_uuid()::text,'-',''));
 insert into public.pfsa_records(kind,user_id,data) values('document',new.user_id,jsonb_build_object('type','Offer Letter','number',number,'candidate',candidate.name,'email',candidate.email,'programme',new.data->>'programme','batch',coalesce(nullif(candidate.cohort,''),'A1/2026'),'start_date',coalesce(candidate.start_date,'2026-11-17'::date),'end_date',coalesce(batch_end,coalesce(candidate.start_date,'2026-11-17'::date)+27),'status','published','generated',1,'application',new.id));
 return new;
end $$;
-- Add snapshots to existing generated offers; retain their original numbers and names.
update public.pfsa_records d set data=d.data||jsonb_build_object('batch','A1/2026','start_date','2026-11-17','end_date','2026-12-14','email',p.email) from public.pfsa_profiles p where d.user_id=p.id and d.kind='document' and d.data->>'type'='Offer Letter' and d.data->>'generated'='1' and not(d.data ? 'batch');
create or replace function public.pfsa_auth_flow_version() returns text language sql immutable security invoker set search_path='' as $$select 'name-confirmation-a1-v1'::text$$;
grant execute on function public.pfsa_auth_flow_version() to anon,authenticated;
COMMIT;
select 'PFSA sign-in and offer update complete' as result;
