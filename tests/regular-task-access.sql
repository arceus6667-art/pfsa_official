begin;
do $test$
declare student uuid;domain text;week integer;denied boolean:=false;notice uuid;
begin
 select s.user_id,s.programme into student,domain from public.pfsa_start_selections s join public.pfsa_records a on a.user_id=s.user_id and a.kind='application' and a.data->>'status'='approved' and a.data->>'programme'=s.programme where s.mode='regular' and not exists(select 1 from public.pfsa_records r where r.user_id=s.user_id and r.kind='submission') limit 1;
 if student is null then raise exception 'No regular student fixture';end if;
 update public.pfsa_start_selections set start_at=now()+interval '7 days',legacy_access=false,payment_id=null where user_id=student;
 perform set_config('request.jwt.claims',json_build_object('sub',student,'role','authenticated','app_metadata','{}'::json)::text,true);
 set local role authenticated;
 for week in 1..4 loop
 insert into public.pfsa_records(kind,user_id,data) values('submission',student,jsonb_build_object('programme',domain,'week',week,'path',student::text||'/qa-work.txt','filename','qa-work.txt','description',repeat('learning ',200),'status','submitted'));
 end loop;
 if (select count(*) from public.pfsa_records where kind='submission' and user_id=student and data->>'programme'=domain)<>4 then raise exception 'All weeks were not saved';end if;
 notice:=public.pfsa_ensure_programme_notice();
 if not exists(select 1 from public.pfsa_notifications where id=notice and start_stage='early') then raise exception 'Access notice missing';end if;
 reset role;
 update public.pfsa_start_selections set mode='early',payment_id=null where user_id=student;
 set local role authenticated;
 begin
 insert into public.pfsa_records(kind,user_id,data) values('submission',student,jsonb_build_object('programme',domain,'week',1,'path',student::text||'/qa-work.txt','description',repeat('learning ',200),'status','submitted'));
 exception when others then if sqlerrm like 'Choose your start option%' then denied:=true;else raise;end if;end;
 if not denied then raise exception 'Unpaid Early Start guard failed';end if;
 reset role;
end $test$;
rollback;
select 'PASS: regular student submitted all four weeks before batch start; access notice available; unpaid Early Start still restricted; no test records saved' result;
