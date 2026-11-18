-- Disposable fixtures only. Every row and fake UTR is rolled back.
begin;
do $test$
declare domain text;mode text;student uuid;w integer;payment uuid;choice public.pfsa_start_selections;blocked boolean;fixtures integer:=0;
begin
 foreach domain in array array['computer-cyber','mobile','network','cloud','database','iot'] loop
  foreach mode in array array['regular','early'] loop
   student:=gen_random_uuid();
   insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
    values(student,'authenticated','authenticated','pfsa-qa-'||student::text||'@example.invalid','{}','{"name":"PFSA disposable QA"}',now(),now());
   insert into public.pfsa_profiles(id,name,email,name_confirmed_at,cohort,start_date)
    values(student,'PFSA disposable QA','pfsa-qa-'||student::text||'@example.invalid',now(),'QA/2026',current_date+7);
   perform set_config('request.jwt.claims',jsonb_build_object('sub',student,'role','authenticated','email','pfsa-qa-'||student::text||'@example.invalid','app_metadata','{}'::jsonb)::text,true);
   set local role authenticated;
   insert into public.pfsa_records(kind,user_id,data) values('application',student,jsonb_build_object('programme',domain,'status','pending'));
   select * into choice from public.pfsa_choose_start(mode,true,case when mode='early' then 'QA-FAKE-'||student::text else '' end,'');
   for w in 1..4 loop
    insert into public.pfsa_records(kind,user_id,data) values('submission',student,jsonb_build_object('programme',domain,'week',w,'path',student::text||'/qa.txt','filename','qa.txt','description','','status','submitted'));
   end loop;
   if (select count(distinct data->>'week') from public.pfsa_records where user_id=student and kind='submission')<>4 then raise exception 'Four submissions missing for %/%',domain,mode;end if;
   if mode='regular' then
    insert into public.pfsa_records(kind,user_id,data) values('payment',student,jsonb_build_object('programme',domain,'package','bundle','amount',500,'price_version',public.pfsa_pricing_version(),'utr','QA-FAKE-'||student::text,'path','','status','pending','terms_accepted',1,'terms_version','PFSA-DOCUMENTS-2026-11-12')) returning id into payment;
   else payment:=choice.payment_id;end if;
   if not exists(select 1 from public.pfsa_records where id=payment and user_id=student and data->>'status'='pending') then raise exception 'Payment not visible/pending for %/%',domain,mode;end if;
   if exists(select 1 from public.pfsa_records where user_id=student and kind='document' and data->>'type'<>'Offer Letter') then raise exception 'Fake UTR incorrectly issued completion documents';end if;
   blocked:=false;
   begin
    insert into public.pfsa_records(kind,user_id,data) values('payment',student,jsonb_build_object('programme',domain,'package','bundle','amount',500,'price_version',public.pfsa_pricing_version(),'utr','QA-DUPLICATE-'||student::text,'status','pending','terms_accepted',1,'terms_version','PFSA-DOCUMENTS-2026-11-12'));
   exception when others then blocked:=true;end;
   if not blocked then raise exception 'Duplicate order accepted for %/%',domain,mode;end if;
   reset role;fixtures:=fixtures+1;
  end loop;
 end loop;
 if fixtures<>12 then raise exception 'Expected twelve test journeys';end if;
end $test$;
rollback;
select 'PASS: all six domains, regular and Early Start; four submissions; fake UTR visible as pending; duplicate payment blocked; no completion documents issued for fake payment. All 12 fixtures rolled back.' result;
