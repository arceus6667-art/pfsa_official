begin;
do $test$
declare student uuid;domain text;payment uuid;choice public.pfsa_start_selections;begin
 if not public.pfsa_valid_payment_reference('1') or not public.pfsa_valid_payment_reference('ID 7') or public.pfsa_valid_payment_reference(' ') then raise exception 'Reference validation failed';end if;
 select a.user_id,a.data->>'programme' into student,domain from public.pfsa_records a join public.pfsa_profiles p on p.id=a.user_id where a.kind='application' and a.data->>'status'='approved' and p.name_confirmed_at is not null and not exists(select 1 from public.pfsa_start_selections s where s.user_id=a.user_id) and not exists(select 1 from pfsa_private.payment_claims c where c.user_id=a.user_id) limit 1;
 if student is null then raise exception 'Early fixture missing';end if;
 update public.pfsa_profiles set start_date=current_date+7 where id=student;
 perform set_config('request.jwt.claims',json_build_object('sub',student,'role','authenticated','app_metadata','{}'::json)::text,true);
 set local role authenticated;
 select * into choice from public.pfsa_choose_start('early',true,'AB1','');
 if choice.payment_id is null then raise exception 'Early order missing';end if;
 if not exists(select 1 from public.pfsa_records where id=choice.payment_id and data->>'utr'='AB1' and data->>'status'='pending') then raise exception 'Early short reference or review status failed';end if;
 reset role;
 select s.user_id,s.programme into student,domain from public.pfsa_start_selections s where mode='regular' and not exists(select 1 from pfsa_private.payment_claims c where c.user_id=s.user_id) and not exists(select 1 from public.pfsa_records r where r.kind='submission' and r.user_id=s.user_id) limit 1;
 if student is null then raise exception 'Regular fixture missing';end if;
 perform set_config('request.jwt.claims',json_build_object('sub',student,'role','authenticated','app_metadata','{}'::json)::text,true);
 set local role authenticated;
 for week in 1..4 loop insert into public.pfsa_records(kind,user_id,data) values('submission',student,jsonb_build_object('programme',domain,'week',week,'description','','status','submitted'));end loop;
 insert into public.pfsa_records(kind,user_id,data) values('payment',student,jsonb_build_object('programme',domain,'package','bundle','price_version',public.pfsa_pricing_version(),'utr','ID 7','status','pending','terms_accepted',1,'terms_version','PFSA-DOCUMENTS-2026-11-12')) returning id into payment;
 if not exists(select 1 from public.pfsa_records where id=payment and data->>'utr'='ID 7' and data->>'status'='pending') then raise exception 'Regular reference/review status failed';end if;
 reset role;
end $test$;
rollback;
select 'PASS: short Early Bird and regular references accepted; spaces accepted; blank rejected; both payments remain pending. Test changes rolled back.' result;
