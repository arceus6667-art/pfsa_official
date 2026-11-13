begin;
do $$
declare
 owner_uuid uuid; other_uuid uuid; admin_uuid uuid; ticket_uuid uuid:=gen_random_uuid();
 student_reply uuid:=gen_random_uuid();staff_reply uuid:=gen_random_uuid(); row_reply public.pfsa_support_replies;n integer;
begin
 select user_id into owner_uuid from public.pfsa_records where kind='support' limit 1;
 select id into admin_uuid from auth.users where raw_app_meta_data->>'pfsa_role'='admin' limit 1;
 select id into other_uuid from auth.users where id<>owner_uuid and id<>admin_uuid limit 1;
 insert into public.pfsa_records(id,kind,user_id,data) values(ticket_uuid,'support',owner_uuid,'{"subject":"__SUPPORT_QA__","message":"Rollback-only privacy test","status":"open"}');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_uuid,'role','authenticated','app_metadata','{}'::jsonb)::text,true);
 execute 'set local role authenticated';
 insert into public.pfsa_support_replies(id,ticket_id,author_id,author_role,body) values(student_reply,ticket_uuid,admin_uuid,'admin','  Student follow-up  ') returning * into row_reply;
 if row_reply.author_id<>owner_uuid or row_reply.author_role<>'student' or row_reply.body<>'Student follow-up' then raise exception 'Author spoof protection failed';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',other_uuid,'role','authenticated','app_metadata','{}'::jsonb)::text,true);
 select count(*) into n from public.pfsa_support_replies where id=student_reply;
 if n<>0 then raise exception 'Another student can read this thread';end if;
 begin
  insert into public.pfsa_support_replies(ticket_id,body) values(ticket_uuid,'Unauthorised reply');
  raise exception 'Unauthorised reply was allowed';
 exception when insufficient_privilege then null;end;
 begin
  perform public.pfsa_mark_support_read(ticket_uuid,student_reply);
  raise exception 'Another student could mark this thread as read';
 exception when raise_exception then if sqlerrm<>'Support thread not available.' then raise;end if;end;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',admin_uuid,'role','authenticated','app_metadata',jsonb_build_object('pfsa_role','admin'))::text,true);
 insert into public.pfsa_support_replies(id,ticket_id,body) values(staff_reply,ticket_uuid,'Staff response') returning * into row_reply;
 if row_reply.author_role<>'admin' then raise exception 'Staff role missing';end if;
 select count(*) into n from public.pfsa_records where id=ticket_uuid and data->>'status'='answered';
 if n<>1 then raise exception 'Ticket status not updated';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_uuid,'role','authenticated','app_metadata','{}'::jsonb)::text,true);
 select count(*) into n from public.pfsa_support_replies r where r.ticket_id=ticket_uuid and id in (student_reply,staff_reply);
 if n<>2 then raise exception 'Owner cannot read conversation';end if;
 perform public.pfsa_mark_support_read(ticket_uuid,staff_reply);
 select count(*) into n from public.pfsa_support_reads r where r.ticket_id=ticket_uuid and user_id=owner_uuid;
 if n<>1 then raise exception 'Read receipt missing';end if;
 begin
  insert into public.pfsa_support_replies(ticket_id,body) values(ticket_uuid,'   ');
  raise exception 'Blank reply accepted';
 exception when check_violation then null;end;
 if has_table_privilege('authenticated','public.pfsa_support_replies','UPDATE') or has_table_privilege('authenticated','public.pfsa_support_replies','DELETE') then raise exception 'Reply history must be immutable';end if;
 if has_table_privilege('anon','public.pfsa_support_replies','SELECT') then raise exception 'Anonymous reply access';end if;
 execute 'reset role';
end $$;
rollback;
