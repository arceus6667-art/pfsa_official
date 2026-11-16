create or replace function public.pfsa_upcoming_batch(at_time timestamptz default now()) returns table(name text,start_date date,end_date date) language plpgsql stable set search_path='' as $$
declare local_time timestamp:=at_time at time zone 'Asia/Kolkata';starts date;label text;
begin
 if at_time<'2026-11-17T00:00:00+05:30'::timestamptz then starts:=date '2026-11-17';label:='A1/2026';
 elsif at_time<'2026-12-15T00:00:00+05:30'::timestamptz then starts:=date '2026-12-15';label:='A2/2026';
 else
  starts:=date_trunc('month',local_time)::date+14;
  if starts<=local_time::date then starts:=(date_trunc('month',local_time)+interval '1 month')::date+14;end if;
  label:=to_char(starts,'MM/YYYY');
 end if;
 return query select label,starts,starts+27;
end $$;
create or replace function pfsa_private.ensure_upcoming_batch() returns void language sql security definer set search_path='' as $$
 insert into public.pfsa_batches(name,start_date,end_date) select name,start_date,end_date from public.pfsa_upcoming_batch() on conflict(name) do nothing;
$$;
revoke all on function pfsa_private.ensure_upcoming_batch() from public,anon,authenticated;
select pfsa_private.ensure_upcoming_batch();
-- Runs at midnight IST. Idempotent inserts retain historical batches and staff edits.
select cron.schedule('pfsa-daily-batch-rollover','30 18 * * *','select pfsa_private.ensure_upcoming_batch();');
-- Only new profile defaults change. Existing student assignments remain intact.
do $$ declare definition text;begin
 definition:=pg_get_functiondef('pfsa_private.protect_profile_identity()'::regprocedure);
 if position($old$new.cohort='A1/2026';new.start_date='2026-11-17';$old$ in definition)=0 then raise exception 'Profile defaults have changed; inspect before updating.';end if;
 execute replace(definition,$old$new.cohort='A1/2026';new.start_date='2026-11-17';$old$,$new$select b.name,b.start_date into new.cohort,new.start_date from public.pfsa_upcoming_batch() b;$new$);
 definition:=pg_get_functiondef('public.pfsa_confirm_name(text)'::regprocedure);
 if position($old$values(uid,clean,official_email,now(),'A1/2026','2026-11-17')$old$ in definition)=0 then raise exception 'Name confirmation defaults have changed; inspect before updating.';end if;
 execute replace(definition,$old$values(uid,clean,official_email,now(),'A1/2026','2026-11-17')$old$,$new$select uid,clean,official_email,now(),b.name,b.start_date from public.pfsa_upcoming_batch() b where true$new$);
 definition:=pg_get_functiondef('pfsa_private.prepare_application()'::regprocedure);
 execute replace(definition,$old$'batch','A1/2026'$old$,$new$'batch',(select p.cohort from public.pfsa_profiles p where p.id=new.user_id)$new$);
end $$;
