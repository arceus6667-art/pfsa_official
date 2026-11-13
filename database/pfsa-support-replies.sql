create table public.pfsa_support_replies (
 id uuid primary key default gen_random_uuid(),
 ticket_id uuid not null references public.pfsa_records(id) on delete cascade,
 author_id uuid not null references auth.users(id),
 author_role text not null check(author_role in ('admin','student')),
 body text not null check(char_length(btrim(body)) between 1 and 5000),
 created_at timestamptz not null default now()
);
create index pfsa_support_reply_thread on public.pfsa_support_replies(ticket_id,created_at,id);
create index pfsa_support_reply_author on public.pfsa_support_replies(author_id);
alter table public.pfsa_support_replies enable row level security;
revoke all on public.pfsa_support_replies from anon,authenticated;
grant select,insert on public.pfsa_support_replies to authenticated;
grant all on public.pfsa_support_replies to service_role;
create policy pfsa_support_reply_read on public.pfsa_support_replies for select to authenticated using(
 exists(select 1 from public.pfsa_records t where t.id=ticket_id and t.kind='support' and (t.user_id=(select auth.uid()) or (select auth.jwt()->'app_metadata'->>'pfsa_role')='admin'))
);
create policy pfsa_support_reply_create on public.pfsa_support_replies for insert to authenticated with check(
 author_id=(select auth.uid()) and author_role=case when (select auth.jwt()->'app_metadata'->>'pfsa_role')='admin' then 'admin' else 'student' end and
 exists(select 1 from public.pfsa_records t where t.id=ticket_id and t.kind='support' and (t.user_id=(select auth.uid()) or (select auth.jwt()->'app_metadata'->>'pfsa_role')='admin'))
);
create function pfsa_private.prepare_support_reply() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in before replying.';end if;
 new.author_id:=auth.uid();new.author_role:=case when auth.jwt()->'app_metadata'->>'pfsa_role'='admin' then 'admin' else 'student' end;
 new.body:=btrim(new.body);new.created_at:=clock_timestamp();return new;
end $$;
revoke all on function pfsa_private.prepare_support_reply() from public,anon,authenticated;
create trigger pfsa_prepare_support_reply before insert on public.pfsa_support_replies for each row execute function pfsa_private.prepare_support_reply();
create function pfsa_private.update_support_thread() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or auth.uid() is distinct from new.author_id then raise exception 'Reply author required.';end if;
 update public.pfsa_records set data=data||jsonb_build_object('status',case when new.author_role='admin' then 'answered' else 'open' end,'last_reply_at',new.created_at,'last_reply_role',new.author_role)
 where id=new.ticket_id and kind='support' and (user_id=auth.uid() or auth.jwt()->'app_metadata'->>'pfsa_role'='admin');
 if not found then raise exception 'Support thread not available.';end if;return new;
end $$;
revoke all on function pfsa_private.update_support_thread() from public,anon,authenticated;
create trigger pfsa_update_support_thread after insert on public.pfsa_support_replies for each row execute function pfsa_private.update_support_thread();

create table public.pfsa_support_reads (
 ticket_id uuid not null references public.pfsa_records(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 last_read_at timestamptz not null,
 primary key(ticket_id,user_id)
);
create index pfsa_support_read_owner on public.pfsa_support_reads(user_id);
alter table public.pfsa_support_reads enable row level security;
revoke all on public.pfsa_support_reads from anon,authenticated;
grant select on public.pfsa_support_reads to authenticated;
grant all on public.pfsa_support_reads to service_role;
create policy pfsa_support_read_own on public.pfsa_support_reads for select to authenticated using(user_id=(select auth.uid()));
create function public.pfsa_mark_support_read(ticket uuid,through_reply uuid) returns void language plpgsql security definer set search_path='' as $$
declare seen_at timestamptz;
begin
 if auth.uid() is null or not exists(select 1 from public.pfsa_records t where t.id=ticket and t.kind='support' and (t.user_id=auth.uid() or auth.jwt()->'app_metadata'->>'pfsa_role'='admin')) then raise exception 'Support thread not available.';end if;
 select created_at into seen_at from public.pfsa_support_replies where id=through_reply and ticket_id=ticket;
 if seen_at is null then raise exception 'Reply not found.';end if;
 insert into public.pfsa_support_reads(ticket_id,user_id,last_read_at) values(ticket,auth.uid(),seen_at)
 on conflict(ticket_id,user_id) do update set last_read_at=greatest(public.pfsa_support_reads.last_read_at,excluded.last_read_at);
end $$;
revoke all on function public.pfsa_mark_support_read(uuid,uuid) from public,anon;
grant execute on function public.pfsa_mark_support_read(uuid,uuid) to authenticated;
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  alter publication supabase_realtime add table public.pfsa_support_replies,public.pfsa_support_reads;
 end if;
end $$;
