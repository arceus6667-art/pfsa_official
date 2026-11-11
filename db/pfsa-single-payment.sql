-- Run in PFSA project rxiqubmkzqvspnzdasiz > SQL Editor.
BEGIN;
-- Preserve historical payments; a private claim prevents concurrent/new orders.
create schema if not exists pfsa_private;
revoke all on schema pfsa_private from public,anon,authenticated;
create table if not exists pfsa_private.payment_claims (
 user_id uuid primary key references auth.users(id) on delete cascade,
 claimed_at timestamptz not null default now()
);
alter table pfsa_private.payment_claims enable row level security;
revoke all on pfsa_private.payment_claims from public,anon,authenticated;
lock table public.pfsa_records in share row exclusive mode;
insert into pfsa_private.payment_claims(user_id,claimed_at)
select user_id,min(created_at) from public.pfsa_records where kind='payment' and user_id is not null group by user_id
on conflict(user_id) do nothing;
create or replace function pfsa_private.guard_payment_order() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.kind<>'payment' then return new;end if;
 if auth.uid() is null or (auth.uid() is distinct from new.user_id and coalesce(auth.jwt()->'app_metadata'->>'pfsa_role','')<>'admin') then
  raise exception 'An authenticated order owner is required.';
 end if;
 if coalesce(new.data->>'terms_accepted','')<>'1' or coalesce(new.data->>'terms_version','')<>'PFSA-DOCUMENTS-2026-11-12' then
  raise exception 'Accept the six-hour payment and project review terms before submitting.';
 end if;
 if btrim(coalesce(new.data->>'utr',''))='' then raise exception 'Enter your transaction reference / UTR.';end if;
 begin
  insert into pfsa_private.payment_claims(user_id) values(new.user_id);
 exception when unique_violation then
  raise exception 'You already have a document order. Do not pay again; check its status or contact support.' using errcode='23505';
 end;
 new.data=new.data||jsonb_build_object('terms_accepted_at',now(),'status','pending');
 return new;
end $$;
revoke all on function pfsa_private.guard_payment_order() from public,anon,authenticated;
drop trigger if exists pfsa_order_guard on public.pfsa_records;
create trigger pfsa_order_guard before insert on public.pfsa_records for each row when(new.kind='payment') execute function pfsa_private.guard_payment_order();
create or replace function public.pfsa_order_policy_version() returns text language sql immutable security invoker set search_path='' as $$select 'one-payment-v1'::text$$;
grant execute on function public.pfsa_order_policy_version() to anon,authenticated;
COMMIT;
select 'PFSA single payment update complete' as result,public.pfsa_order_policy_version() as policy_version;
