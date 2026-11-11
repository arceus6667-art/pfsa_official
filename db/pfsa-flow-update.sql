-- Run once in PFSA project rxiqubmkzqvspnzdasiz > SQL Editor.
BEGIN;
create or replace function public.pfsa_word_count(value text) returns integer language sql immutable security invoker set search_path='' as $$
 select case when btrim(normalized)='' then 0 else cardinality(regexp_split_to_array(btrim(normalized),'[[:space:]]+')) end
 from (select regexp_replace(translate(coalesce(value,''),chr(160)||chr(8239)||chr(8203),'   '),'[[:space:]]+',' ','g') normalized) s;
$$;
grant execute on function public.pfsa_word_count(text) to authenticated;
drop policy pfsa_record_create on public.pfsa_records;
create policy pfsa_record_create on public.pfsa_records for insert to authenticated with check(
 (select auth.jwt()->'app_metadata'->>'pfsa_role')='admin' or
 (user_id=(select auth.uid()) and (
 (kind='application' and data->>'status'='approved') or
 (kind='submission' and data->>'status'='submitted' and not(data ? 'marks') and (data->>'week')::int between 1 and 4 and public.pfsa_word_count(data->>'description')>=200) or
 (kind='payment' and data->>'status'='pending' and data->>'package' in ('experience','recommendation','bundle')) or
 (kind='support' and data->>'status'='open'))));
create schema if not exists pfsa_private;
revoke all on schema pfsa_private from public,anon,authenticated;
create or replace function pfsa_private.prepare_application() returns trigger language plpgsql security invoker set search_path='' as $$ begin
 if new.kind='application' then
  if new.data->>'programme' not in ('computer-cyber','mobile','network','cloud','database','iot') then raise exception 'Choose a valid internship domain.';end if;
  new.data=jsonb_build_object('programme',new.data->>'programme','status','approved');
 end if;return new;end $$;
revoke all on function pfsa_private.prepare_application() from public;
drop trigger if exists pfsa_prepare_application on public.pfsa_records;
create trigger pfsa_prepare_application before insert on public.pfsa_records for each row execute function pfsa_private.prepare_application();
create or replace function pfsa_private.issue_offer() returns trigger language plpgsql security definer set search_path='' as $$
declare candidate text;begin
 if new.kind<>'application' then return new;end if;
 if auth.uid() is distinct from new.user_id and coalesce(auth.jwt()->'app_metadata'->>'pfsa_role','')<>'admin' then raise exception 'An authenticated application owner is required.';end if;
 select name into candidate from public.pfsa_profiles where id=new.user_id;
 if candidate is null then raise exception 'Complete your student profile before applying.';end if;
 insert into public.pfsa_records(kind,user_id,data) values('document',new.user_id,jsonb_build_object('type','Offer Letter','number','PFSA-OFFER-'||upper(replace(new.id::text,'-','')),'candidate',candidate,'programme',new.data->>'programme','status','published','generated',1,'application',new.id));
 return new;end $$;
revoke all on function pfsa_private.issue_offer() from public;
drop trigger if exists pfsa_issue_offer on public.pfsa_records;
create trigger pfsa_issue_offer after insert on public.pfsa_records for each row when(new.kind='application') execute function pfsa_private.issue_offer();
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
  if total<>4 then raise exception 'Submit all four weekly projects before requesting completion documents.';end if;
  new.data=new.data||jsonb_build_object('amount',case when new.data->>'package'='bundle' then 200 else 150 end);
 end if;
 if new.kind='document' and new.data->>'status'='published' and new.data->>'type'<>'Offer Letter' then
  select count(distinct data->>'week') into total from public.pfsa_records where kind='submission' and user_id=new.user_id and data->>'programme'=new.data->>'programme' and data->>'status'='reviewed';
  if total<>4 then raise exception 'Four reviewed projects are required before document publication.';end if;
  if not exists(select 1 from public.pfsa_records p where p.kind='payment' and p.user_id=new.user_id and p.data->>'status'='approved' and (p.data->>'package' in ('bundle','199','600') or (new.data->>'type' in ('Letter of Experience','Certificate of Experience','Letter of Completion') and p.data->>'package' in ('experience','150')) or (new.data->>'type'='Letter of Recommendation' and p.data->>'package'='recommendation'))) then raise exception 'An approved payment for this document is required.';end if;
 end if;return new;end $$;
-- Existing pending applications become active; rejected applications are preserved.
update public.pfsa_records set data=data||'{"status":"approved"}'::jsonb where kind='application' and data->>'status'='pending';
insert into public.pfsa_records(kind,user_id,data)
select 'document',a.user_id,jsonb_build_object('type','Offer Letter','number','PFSA-OFFER-'||upper(replace(a.id::text,'-','')),'candidate',p.name,'programme',a.data->>'programme','status','published','generated',1,'application',a.id)
from public.pfsa_records a join public.pfsa_profiles p on p.id=a.user_id
where a.kind='application' and a.data->>'status'='approved' and not exists(select 1 from public.pfsa_records d where d.kind='document' and d.user_id=a.user_id and d.data->>'type'='Offer Letter' and d.data->>'programme'=a.data->>'programme');
COMMIT;
select 'PFSA flow update complete' as result,public.pfsa_word_count(repeat('word ',200)) as word_count_check;
