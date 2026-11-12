-- Start choices are account-owned, immutable through the client, and server validated.
create table if not exists public.pfsa_start_selections (
 user_id uuid primary key references auth.users(id) on delete cascade,
 programme text not null,
 mode text not null check (mode in ('early','regular')),
 terms_version text not null,
 accepted_at timestamptz not null default now(),
 start_at timestamptz not null,
 payment_id uuid references public.pfsa_records(id),
 legacy_access boolean not null default false
);
alter table public.pfsa_start_selections enable row level security;
revoke all on public.pfsa_start_selections from anon,authenticated;
grant select on public.pfsa_start_selections to authenticated;
create policy pfsa_start_read on public.pfsa_start_selections for select to authenticated using(user_id=(select auth.uid()) or (select auth.jwt()->'app_metadata'->>'pfsa_role')='admin');
-- Preserve existing learning/payment history without imposing a new checkout.
insert into public.pfsa_start_selections(user_id,programme,mode,terms_version,start_at,legacy_access)
select a.user_id,a.data->>'programme','regular','existing-enrolment',coalesce(p.start_date,date '2026-11-17')::timestamp at time zone 'Asia/Kolkata',true
from public.pfsa_records a join public.pfsa_profiles p on p.id=a.user_id
where a.kind='application' and exists(select 1 from public.pfsa_records r where r.user_id=a.user_id and r.kind in ('submission','payment'))
on conflict(user_id) do nothing;

create or replace function public.pfsa_start_options() returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('version','start-choice-v1','batch',p.cohort,'start_at',coalesce(p.start_date,date '2026-11-17')::timestamp at time zone 'Asia/Kolkata','early_available',now() < (coalesce(p.start_date,date '2026-11-17')::timestamp at time zone 'Asia/Kolkata'),'early_price',400)
 from public.pfsa_profiles p where p.id=auth.uid()
$$;
revoke all on function public.pfsa_start_options() from public, anon;
grant execute on function public.pfsa_start_options() to authenticated;

create or replace function pfsa_private.choose_start(start_mode text, terms_accepted boolean, transaction_reference text default '', screenshot_path text default '')
returns public.pfsa_start_selections language plpgsql security definer set search_path='' as $$
declare uid uuid := auth.uid(); a public.pfsa_records; p public.pfsa_profiles; choice public.pfsa_start_selections; starts timestamptz; payment uuid;
begin
 if uid is null then raise exception 'Sign in to choose your start.';end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 select * into choice from public.pfsa_start_selections where user_id=uid;
 if found then return choice;end if;
 if terms_accepted is distinct from true then raise exception 'Accept the start and document terms before continuing.';end if;
 if start_mode not in ('early','regular') or start_mode is null then raise exception 'Choose Early Start or Regular Start.';end if;
 select * into p from public.pfsa_profiles where id=uid;
 if p.name_confirmed_at is null then raise exception 'Confirm your document name first.';end if;
 select * into a from public.pfsa_records where user_id=uid and kind='application' and data->>'status'='approved';
 if a.id is null then raise exception 'An active internship application is required.';end if;
 starts := coalesce(p.start_date,date '2026-11-17')::timestamp at time zone 'Asia/Kolkata';
 if start_mode='early' then
  if now()>=starts then raise exception 'Early Start has closed. Choose Regular Start.';end if;
  if length(btrim(transaction_reference))<6 or length(btrim(transaction_reference))>100 then raise exception 'Enter the valid payment transaction reference / UTR.';end if;
  if screenshot_path<>'' and split_part(screenshot_path,'/',1)<>uid::text then raise exception 'Upload your own payment screenshot.';end if;
 end if;
 insert into public.pfsa_start_selections(user_id,programme,mode,terms_version,start_at)
 values(uid,a.data->>'programme',start_mode,'PFSA-START-2026-11-12',starts);
 if start_mode='early' then
  insert into public.pfsa_records(kind,user_id,data) values('payment',uid,jsonb_build_object(
   'programme',a.data->>'programme','package','bundle','order_type','early_start','amount',400,
   'price_version',public.pfsa_pricing_version(),'status','pending','utr',btrim(transaction_reference),'path',screenshot_path,
   'terms_accepted',1,'terms_version','PFSA-DOCUMENTS-2026-11-12','start_terms_version','PFSA-START-2026-11-12')) returning id into payment;
  update public.pfsa_start_selections set payment_id=payment where user_id=uid;
 end if;
 update public.pfsa_records set data=data||jsonb_build_object('start_mode',start_mode,'start_terms_accepted_at',now()) where id=a.id;
 select * into choice from public.pfsa_start_selections where user_id=uid;
 return choice;
end $$;
revoke all on function pfsa_private.choose_start(text,boolean,text,text) from public;
grant usage on schema pfsa_private to authenticated;
grant execute on function pfsa_private.choose_start(text,boolean,text,text) to authenticated;
create or replace function public.pfsa_choose_start(start_mode text, terms_accepted boolean, transaction_reference text default '', screenshot_path text default '')
returns public.pfsa_start_selections language sql security invoker set search_path='' as $$
 select pfsa_private.choose_start(start_mode,terms_accepted,transaction_reference,screenshot_path)
$$;
revoke all on function public.pfsa_choose_start(text,boolean,text,text) from public, anon;
grant execute on function public.pfsa_choose_start(text,boolean,text,text) to authenticated;

create or replace function pfsa_private.enforce_document_pricing() returns trigger language plpgsql set search_path='' as $$
declare price integer;
begin
 if coalesce(new.data->>'price_version','')<>public.pfsa_pricing_version() then raise exception 'Document prices have changed. Refresh before paying.';end if;
 if new.data->>'order_type'='early_start' then
  if new.data->>'package'<>'bundle' or not exists(select 1 from public.pfsa_start_selections s where s.user_id=new.user_id and s.programme=new.data->>'programme' and s.mode='early' and s.start_at>now()) then raise exception 'Early Start is not available for this account.';end if;
  price:=400;
 else price:=public.pfsa_document_price(new.data->>'package');end if;
 if price is null then raise exception 'Select a valid document package.';end if;
 new.data:=new.data||jsonb_build_object('amount',price,'price_version',public.pfsa_pricing_version());return new;
end $$;

-- Enforce the selected start date even for direct API submissions.
create or replace function pfsa_private.enforce_learning_start() returns trigger language plpgsql set search_path='' as $$
begin
 if not exists(select 1 from public.pfsa_start_selections s where s.user_id=new.user_id and s.programme=new.data->>'programme' and (s.legacy_access or s.start_at<=now() or (s.mode='early' and s.payment_id is not null))) then
 raise exception 'Choose your start option. Regular submissions open on your assigned batch date.';
 end if;return new;
end $$;
create trigger pfsa_learning_start before insert on public.pfsa_records for each row when(new.kind='submission') execute function pfsa_private.enforce_learning_start();

create or replace function public.pfsa_validate_record() returns trigger language plpgsql security invoker set search_path='' as $$
declare total integer;begin
 if new.kind='submission' then
  if not exists(select 1 from public.pfsa_records a where a.kind='application' and a.user_id=new.user_id and a.data->>'programme'=new.data->>'programme' and a.data->>'status'='approved') then raise exception 'An active internship is required.';end if;
  if not exists(select 1 from public.pfsa_records t where t.kind='task' and t.data->>'programme'=new.data->>'programme' and t.data->>'week'=new.data->>'week') then raise exception 'This weekly task has not been published.';end if;
  if public.pfsa_word_count(new.data->>'description')<200 then raise exception 'Please enter at least 200 words in the project description.';end if;
  if new.data ? 'marks' and ((new.data->>'marks')::numeric<0 or (new.data->>'marks')::numeric>100) then raise exception 'Marks must be between 0 and 100.';end if;
 end if;
 if new.kind='payment' and TG_OP='INSERT' then
  if new.data->>'package' not in ('experience','recommendation','bundle') then raise exception 'Select Experience, Recommendation or the combined package.';end if;
  select count(distinct s.data->>'week') into total from public.pfsa_records s join public.pfsa_records a on a.kind='application' and a.user_id=s.user_id and a.data->>'programme'=s.data->>'programme' where s.kind='submission' and s.user_id=new.user_id;
  if total<>4 and coalesce(new.data->>'order_type','')<>'early_start' then raise exception 'Submit all four weekly projects before requesting completion documents.';end if;
  new.data=new.data||jsonb_build_object('amount',case when new.data->>'package'='bundle' then 200 else 150 end);
 end if;
 if new.kind='document' and new.data->>'status'='published' and new.data->>'type'<>'Offer Letter' then
  select count(distinct data->>'week') into total from public.pfsa_records where kind='submission' and user_id=new.user_id and data->>'programme'=new.data->>'programme' and data->>'status'='reviewed';
  if total<>4 then raise exception 'Four reviewed projects are required before document publication.';end if;
  if not exists(select 1 from public.pfsa_records p where p.kind='payment' and p.user_id=new.user_id and p.data->>'status'='approved' and (p.data->>'package' in ('bundle','199','600') or (new.data->>'type' in ('Letter of Experience','Certificate of Experience','Letter of Completion') and p.data->>'package' in ('experience','150')) or (new.data->>'type'='Letter of Recommendation' and p.data->>'package'='recommendation'))) then raise exception 'An approved payment for this document is required.';end if;
 end if;return new;end $$;
