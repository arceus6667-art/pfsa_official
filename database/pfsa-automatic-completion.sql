-- Descriptions are optional. Publication requires four actual weekly submissions
-- and a staff-approved payment for this same student and programme.
create or replace function public.pfsa_validate_record() returns trigger language plpgsql set search_path='' as $$
declare total integer;begin
 if new.kind='submission' then
  if not exists(select 1 from public.pfsa_records a where a.kind='application' and a.user_id=new.user_id and a.data->>'programme'=new.data->>'programme' and a.data->>'status'='approved') then raise exception 'An active internship is required.';end if;
  if not exists(select 1 from public.pfsa_records t where t.kind='task' and t.data->>'programme'=new.data->>'programme' and t.data->>'week'=new.data->>'week') then raise exception 'This weekly task has not been published.';end if;
  if new.data->>'week' not in ('1','2','3','4') then raise exception 'Choose a valid internship week.';end if;
  if new.data ? 'marks' and ((new.data->>'marks')::numeric<0 or (new.data->>'marks')::numeric>100) then raise exception 'Marks must be between 0 and 100.';end if;
 end if;
 if new.kind='payment' and TG_OP='INSERT' then
  if new.data->>'package' not in ('experience','recommendation','bundle') then raise exception 'Select a valid document package.';end if;
  select count(distinct s.data->>'week') into total from public.pfsa_records s where s.kind='submission' and s.user_id=new.user_id and s.data->>'programme'=new.data->>'programme' and s.data->>'week' in ('1','2','3','4');
  if total<>4 and coalesce(new.data->>'order_type','')<>'early_start' then raise exception 'Submit all four weekly projects before requesting completion documents.';end if;
 end if;
 if new.kind='document' and new.data->>'status'='published' and new.data->>'type'<>'Offer Letter' then
  select count(distinct data->>'week') into total from public.pfsa_records where kind='submission' and user_id=new.user_id and data->>'programme'=new.data->>'programme' and data->>'week' in ('1','2','3','4');
  if total<>4 then raise exception 'Four weekly submissions are required before document publication.';end if;
  if not exists(select 1 from public.pfsa_records p where p.kind='payment' and p.user_id=new.user_id and p.data->>'programme'=new.data->>'programme' and p.data->>'status'='approved' and (p.data->>'package' in ('bundle','199','200','600') or (new.data->>'type' in ('Letter of Experience','Certificate of Experience','Letter of Completion') and p.data->>'package' in ('experience','150')) or (new.data->>'type'='Letter of Recommendation' and p.data->>'package'='recommendation'))) then raise exception 'An approved payment for this document is required.';end if;
 end if;return new;
end $$;

create or replace function pfsa_private.issue_completion(candidate_id uuid,domain_id text) returns void language plpgsql security definer set search_path='' as $$
declare profile public.pfsa_profiles;application public.pfsa_records;payment public.pfsa_records;doc_type text;types text[];batch_end date;begin
 perform pg_advisory_xact_lock(hashtextextended(candidate_id::text||':completion:'||domain_id,0));
 select * into application from public.pfsa_records where kind='application' and user_id=candidate_id and data->>'programme'=domain_id and data->>'status'='approved';if not found then return;end if;
 if (select count(distinct data->>'week') from public.pfsa_records where kind='submission' and user_id=candidate_id and data->>'programme'=domain_id and data->>'week' in ('1','2','3','4'))<>4 then return;end if;
 select * into profile from public.pfsa_profiles where id=candidate_id;if profile.name_confirmed_at is null then return;end if;
 select * into payment from public.pfsa_records where kind='payment' and user_id=candidate_id and data->>'programme'=domain_id and data->>'status'='approved' order by created_at limit 1;if not found then return;end if;
 types:=case when payment.data->>'package' in ('bundle','199','200','600') then array['Certificate of Experience','Letter of Recommendation'] when payment.data->>'package' in ('experience','150') then array['Certificate of Experience'] when payment.data->>'package'='recommendation' then array['Letter of Recommendation'] else array[]::text[] end;
 select end_date into batch_end from public.pfsa_batches where name=profile.cohort;
 foreach doc_type in array types loop
  if exists(select 1 from public.pfsa_records where kind='document' and user_id=candidate_id and data->>'programme'=domain_id and data->>'status'='published' and (data->>'type'=doc_type or (doc_type='Certificate of Experience' and data->>'type' in ('Letter of Experience','Letter of Completion')))) then continue;end if;
  insert into public.pfsa_records(kind,user_id,data) values('document',candidate_id,jsonb_build_object('type',doc_type,'number','PFSA-'||case when doc_type='Letter of Recommendation' then 'LOR' else 'EXP' end||'-'||to_char(now(),'YYYY')||'-'||upper(replace(gen_random_uuid()::text,'-','')),'candidate',profile.name,'email',profile.email,'programme',domain_id,'batch',profile.cohort,'start_date',profile.start_date,'end_date',coalesce(batch_end,profile.start_date+27),'status','published','generated',1,'auto_issued',1,'payment',payment.id,'application',application.id));
 end loop;
end $$;
revoke all on function pfsa_private.issue_completion(uuid,text) from public,anon,authenticated;

create or replace function pfsa_private.auto_complete_documents() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.kind in ('submission','payment') then perform pfsa_private.issue_completion(new.user_id,new.data->>'programme');end if;return new;
end $$;
revoke all on function pfsa_private.auto_complete_documents() from public,anon,authenticated;
create trigger pfsa_zz_auto_completion after insert or update on public.pfsa_records for each row when(new.kind in ('submission','payment')) execute function pfsa_private.auto_complete_documents();
-- Include existing eligible orders, without duplicating already published documents.
do $$ declare payment record;begin
 for payment in select distinct user_id,data->>'programme' programme from public.pfsa_records where kind='payment' and data->>'status'='approved' loop perform pfsa_private.issue_completion(payment.user_id,payment.programme);end loop;
end $$;
