begin;
do $test$
declare student uuid;domain text;payment uuid;staff uuid;week integer;count_docs integer;begin
 select s.user_id,s.programme into student,domain from public.pfsa_start_selections s join public.pfsa_profiles p on p.id=s.user_id and p.name_confirmed_at is not null where s.mode='regular' and not exists(select 1 from public.pfsa_records r where r.user_id=s.user_id and r.kind in ('payment','submission')) and not exists(select 1 from pfsa_private.payment_claims c where c.user_id=s.user_id) limit 1;
 select id into staff from auth.users where raw_app_meta_data->>'pfsa_role'='admin' limit 1;
 if student is null then raise exception 'Regular fixture missing';end if;
 perform set_config('request.jwt.claims',json_build_object('sub',student,'role','authenticated','app_metadata','{}'::json)::text,true);
 set local role authenticated;
 for week in 1..4 loop insert into public.pfsa_records(kind,user_id,data) values('submission',student,jsonb_build_object('programme',domain,'week',week,'path',student::text||'/test.zip','filename','test.zip','description','','status','submitted'));end loop;
 if exists(select 1 from public.pfsa_records where kind='document' and user_id=student and data->>'auto_issued'='1') then raise exception 'Issued without payment';end if;
 insert into public.pfsa_records(kind,user_id,data) values('payment',student,jsonb_build_object('programme',domain,'package','bundle','amount',500,'price_version',public.pfsa_pricing_version(),'utr','QA-'||gen_random_uuid()::text,'terms_accepted',1,'terms_version','PFSA-DOCUMENTS-2026-11-12','status','pending')) returning id into payment;
 if exists(select 1 from public.pfsa_records where kind='document' and user_id=student and data->>'auto_issued'='1') then raise exception 'Pending payment auto approved';end if;
 reset role;
 perform set_config('request.jwt.claims',json_build_object('sub',staff,'role','authenticated','app_metadata',json_build_object('pfsa_role','admin'))::text,true);
 set local role authenticated;
 update public.pfsa_records set data=data||jsonb_build_object('status','approved') where id=payment;
 reset role;
 select count(*) into count_docs from public.pfsa_records where kind='document' and user_id=student and data->>'auto_issued'='1';
 if count_docs<>2 then raise exception 'Expected two docs, got %',count_docs;end if;
 perform pfsa_private.issue_completion(student,domain);
 if (select count(*) from public.pfsa_records where kind='document' and user_id=student and data->>'auto_issued'='1')<>2 then raise exception 'Duplicate documents';end if;
 -- Early Bird: reuse the approved test order, clear only test documents and submissions.
 delete from public.pfsa_records where user_id=student and kind='document' and data->>'auto_issued'='1';
 delete from public.pfsa_records where user_id=student and kind='submission';
 update public.pfsa_records set data=data||jsonb_build_object('amount',400,'order_type','early_start') where id=payment;
 for week in 1..3 loop insert into public.pfsa_records(kind,user_id,data) values('submission',student,jsonb_build_object('programme',domain,'week',week,'description','Short notes','status','submitted'));end loop;
 if exists(select 1 from public.pfsa_records where user_id=student and kind='document' and data->>'auto_issued'='1') then raise exception 'Issued before week four';end if;
 insert into public.pfsa_records(kind,user_id,data) values('submission',student,jsonb_build_object('programme',domain,'week',4,'description','','status','submitted'));
 if (select count(*) from public.pfsa_records where kind='document' and user_id=student and data->>'auto_issued'='1')<>2 then raise exception 'Early bundle not auto issued';end if;
end $test$;
rollback;
select 'PASS: empty/short descriptions; four regular submissions + pending payment do not issue; admin approval issues two documents; repeat calls do not duplicate; approved Early Bird issues after fourth submission. All test changes rolled back.' result;
