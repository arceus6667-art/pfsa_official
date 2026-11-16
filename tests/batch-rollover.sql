begin;
do $$ declare sample record;batch record;rows_before integer;begin
 for sample in select * from (values
 ('2026-11-16T23:59:59.999+05:30'::timestamptz,'A1/2026','2026-11-17'::date),
 ('2026-11-17T00:00:00+05:30'::timestamptz,'A2/2026','2026-12-15'::date),
 ('2026-12-14T23:59:59.999+05:30'::timestamptz,'A2/2026','2026-12-15'::date),
 ('2026-12-15T00:00:00+05:30'::timestamptz,'01/2027','2027-01-15'::date),
 ('2027-01-15T00:00:00+05:30'::timestamptz,'02/2027','2027-02-15'::date),
 ('2027-12-15T00:00:00+05:30'::timestamptz,'01/2028','2028-01-15'::date)
 ) as v(at_time,label,starts) loop
  select * into batch from public.pfsa_upcoming_batch(sample.at_time);
  if batch.name<>sample.label or batch.start_date<>sample.starts or batch.end_date<>sample.starts+27 then raise exception 'Batch transition failed for %',sample.at_time;end if;
  insert into public.pfsa_batches(name,start_date,end_date) values(batch.name,batch.start_date,batch.end_date) on conflict(name) do nothing;
 end loop;
 select count(*) into rows_before from public.pfsa_batches;
 perform pfsa_private.ensure_upcoming_batch();perform pfsa_private.ensure_upcoming_batch();
 if (select count(*) from public.pfsa_batches)<>rows_before then raise exception 'Duplicate batch creation';end if;
 if not exists(select 1 from cron.job where jobname='pfsa-daily-batch-rollover' and schedule='30 18 * * *' and active) then raise exception 'Batch rollover job not active';end if;
end $$;
rollback;
select 'PASS: IST boundaries, year rollover, four-week dates, idempotent batch persistence and active scheduled rollover. Test inserts rolled back.' result;
