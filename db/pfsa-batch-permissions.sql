BEGIN;
-- Repair only missing/invalid student assignments; preserve genuine admin-created batches.
update public.pfsa_profiles p set cohort='A1/2026',start_date='2026-11-17' where not exists(select 1 from public.pfsa_batches b where b.name=p.cohort) and exists(select 1 from auth.users u where u.id=p.id and coalesce(u.raw_app_meta_data->>'pfsa_role','')<>'admin');
create or replace function pfsa_private.protect_profile_identity() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if current_user not in ('postgres','supabase_admin') and coalesce(auth.jwt()->'app_metadata'->>'pfsa_role','')<>'admin' then
  if new.id is distinct from auth.uid() then raise exception 'Profile owner required.';end if;
  new.email=auth.jwt()->>'email';
  if TG_OP='INSERT' then
   if new.name_confirmed_at is not null then raise exception 'Confirm your name using the onboarding form.';end if;
   new.cohort='A1/2026';new.start_date='2026-11-17';
  elsif TG_OP='UPDATE' then
   if new.name_confirmed_at is distinct from old.name_confirmed_at then raise exception 'Name confirmation requires the onboarding form.';end if;
   if old.name_confirmed_at is not null and new.name is distinct from old.name then raise exception 'Contact academy staff to correct your document name.';end if;
   if new.cohort is distinct from old.cohort or new.start_date is distinct from old.start_date then raise exception 'Only academy staff can change your batch or programme start date.' using errcode='42501';end if;
  end if;
 end if;return new;
end $$;
revoke all on function pfsa_private.protect_profile_identity() from public,anon,authenticated;
create or replace function public.pfsa_batch_protection_version() returns text language sql immutable security invoker set search_path='' as $$select 'admin-only-batch-v1'::text$$;
grant execute on function public.pfsa_batch_protection_version() to anon,authenticated;
COMMIT;
select 'PFSA batch protection active' as result;
