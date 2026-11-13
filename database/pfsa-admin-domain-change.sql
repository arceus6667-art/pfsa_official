create table public.pfsa_domain_changes (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id),admin_id uuid not null references auth.users(id),
 application_id uuid not null references public.pfsa_records(id),
 previous_programme text,next_programme text not null,reason text not null,
 offer_before jsonb not null default '[]'::jsonb,created_at timestamptz not null default now()
);
create index pfsa_domain_change_owner on public.pfsa_domain_changes(user_id,created_at desc);
create index pfsa_domain_change_admin on public.pfsa_domain_changes(admin_id);
create index pfsa_domain_change_application on public.pfsa_domain_changes(application_id);
alter table public.pfsa_domain_changes enable row level security;
revoke all on public.pfsa_domain_changes from anon,authenticated;
grant select on public.pfsa_domain_changes to authenticated;
grant all on public.pfsa_domain_changes to service_role;
create policy pfsa_domain_changes_staff_read on public.pfsa_domain_changes for select to authenticated using((select auth.jwt()->'app_metadata'->>'pfsa_role')='admin');

create function public.pfsa_admin_change_domain(candidate uuid,new_programme text,expected_programme text,change_reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 actor uuid:=auth.uid();p public.pfsa_profiles;a public.pfsa_records;previous text;offers jsonb;ends date;
begin
 if actor is null or coalesce(auth.jwt()->'app_metadata'->>'pfsa_role','')<>'admin' then raise exception 'Administrator access required.' using errcode='42501';end if;
 if new_programme is null or new_programme not in ('computer-cyber','mobile','network','cloud','database','iot') then raise exception 'Choose one of the six academy domains.' using errcode='22023';end if;
 if change_reason is null or char_length(btrim(change_reason)) not between 3 and 500 then raise exception 'Enter a reason between 3 and 500 characters.' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(candidate::text,0));
 select * into p from public.pfsa_profiles where id=candidate for update;
 if not found then raise exception 'The student profile is not available yet.';end if;
 if exists(select 1 from auth.users where id=candidate and raw_app_meta_data->>'pfsa_role'='admin') then raise exception 'Choose a student account.';end if;
 if p.name_confirmed_at is null then raise exception 'The student must confirm their document name before a domain can be assigned.';end if;
 select * into a from public.pfsa_records where kind='application' and user_id=candidate for update;
 previous:=a.data->>'programme';
 if previous=new_programme then return jsonb_build_object('changed',false,'programme',new_programme);end if;
 if previous is distinct from nullif(expected_programme,'') then raise exception 'This candidate was updated by another session. Refresh before changing the domain.' using errcode='40001';end if;
 if exists(select 1 from public.pfsa_records where kind='document' and user_id=candidate and data->>'programme'=previous and data->>'status'='published' and data->>'type'<>'Offer Letter') then raise exception 'Completion documents have already been issued for this domain. Review document reissuance before transferring this student.';end if;
 if exists(select 1 from public.pfsa_email_jobs where user_id=candidate and kind='offer' and status='processing') then raise exception 'An offer email is currently being sent. Try the domain change again shortly.';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'data',data,'created_at',created_at)),'[]'::jsonb) into offers from public.pfsa_records where kind='document' and user_id=candidate and data->>'type'='Offer Letter' and data->>'programme'=previous and data->>'status'='published';
 if a.id is null then
  insert into public.pfsa_records(kind,user_id,data) values('application',candidate,jsonb_build_object('programme',new_programme,'status','approved')) returning * into a;
 end if;
 update public.pfsa_records set data=data||jsonb_build_object('programme',new_programme,'domain_changed_at',now(),'domain_changed_by',actor) where id=a.id;
 update public.pfsa_start_selections set programme=new_programme where user_id=candidate;
 -- Transfer the existing order entitlement without changing payment amount, status or transaction evidence.
 update public.pfsa_records set data=data||jsonb_build_object('programme',new_programme,'original_programme',coalesce(data->>'original_programme',previous),'domain_transferred_at',now()) where kind='payment' and user_id=candidate and data->>'programme'=previous;
 -- A correction keeps the offer's identity/date; the old issuance snapshot is retained in the audit record.
 update public.pfsa_records set data=(data-'path')||jsonb_build_object('programme',new_programme,'generated',1,'domain_revision',coalesce((data->>'domain_revision')::integer,0)+1,'domain_corrected_at',now())
 where kind='document' and user_id=candidate and data->>'type'='Offer Letter' and data->>'programme'=previous and data->>'status'='published';
 if not exists(select 1 from public.pfsa_records where kind='document' and user_id=candidate and data->>'type'='Offer Letter' and data->>'programme'=new_programme and data->>'status'='published') then
  select end_date into ends from public.pfsa_batches where name=p.cohort;
  insert into public.pfsa_records(kind,user_id,data) values('document',candidate,jsonb_build_object('type','Offer Letter','number','PFSA-OFFER-2026-'||upper(replace(gen_random_uuid()::text,'-','')),'candidate',p.name,'email',p.email,'programme',new_programme,'batch',coalesce(nullif(p.cohort,''),'A1/2026'),'start_date',coalesce(p.start_date,date '2026-11-17'),'end_date',coalesce(ends,coalesce(p.start_date,date '2026-11-17')+27),'status','published','generated',1,'application',a.id));
 end if;
 update public.pfsa_email_jobs j set programme=new_programme where j.kind='offer' and j.user_id=candidate and j.status<>'sent' and exists(select 1 from public.pfsa_records d where d.id=j.source_id and d.data->>'programme'=new_programme);
 insert into public.pfsa_domain_changes(user_id,admin_id,application_id,previous_programme,next_programme,reason,offer_before) values(candidate,actor,a.id,previous,new_programme,btrim(change_reason),offers);
 return jsonb_build_object('changed',true,'programme',new_programme,'previous_programme',previous);
end $$;
revoke all on function public.pfsa_admin_change_domain(uuid,text,text,text) from public,anon;
grant execute on function public.pfsa_admin_change_domain(uuid,text,text,text) to authenticated;
