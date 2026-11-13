begin;
do $test$
declare staff uuid;student uuid;submission uuid;saved integer;
begin
 select id into staff from auth.users where raw_app_meta_data->>'pfsa_role'='admin' limit 1;
 select id,user_id into submission,student from public.pfsa_records where kind='submission' limit 1;
 if submission is null then raise exception 'No existing submission fixture';end if;
 update public.pfsa_records set data=data||jsonb_build_object('status','submitted') where id=submission;
 perform set_config('request.jwt.claims',json_build_object('sub',staff,'role','authenticated','app_metadata',json_build_object('pfsa_role','admin'))::text,true);
 set local role authenticated;
 update public.pfsa_records set data=data||jsonb_build_object('status','reviewed','marks',87,'feedback','Assessment visibility test') where id=submission and kind='submission';
 get diagnostics saved=row_count;
 if saved<>1 then raise exception 'Staff save failed';end if;
 reset role;
 perform set_config('request.jwt.claims',json_build_object('sub',student,'role','authenticated','app_metadata','{}'::json)::text,true);
 set local role authenticated;
 if not exists(select 1 from public.pfsa_records where id=submission and data->>'status'='reviewed' and data->>'marks'='87' and data->>'feedback'='Assessment visibility test') then raise exception 'Student cannot read saved assessment';end if;
 update public.pfsa_records set data=data||jsonb_build_object('marks',100) where id=submission;
 get diagnostics saved=row_count;
 if saved<>0 then raise exception 'Student changed own marks';end if;
 reset role;
end $test$;
rollback;
select 'PASS: staff assessment saved as reviewed; student can read marks and feedback but cannot change them. Test changes rolled back.' result;
