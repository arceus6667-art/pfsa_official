-- Apply to future payment submissions only; preserve existing payment records.
create or replace function public.pfsa_valid_payment_reference(value text)
returns boolean language sql immutable security invoker set search_path='' as $$
 select btrim(coalesce(value,'')) ~ '^[^[:space:]]{12,100}$'
$$;
revoke all on function public.pfsa_valid_payment_reference(text) from public,anon;
grant execute on function public.pfsa_valid_payment_reference(text) to authenticated;

create or replace function pfsa_private.validate_payment_reference()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if not public.pfsa_valid_payment_reference(new.data->>'utr') then
  raise exception 'Enter the valid UTR of 12 digits.' using errcode='22023';
 end if;
 new.data:=new.data||jsonb_build_object('utr',btrim(new.data->>'utr'));
 return new;
end $$;
revoke all on function pfsa_private.validate_payment_reference() from public;
drop trigger if exists pfsa_00_payment_reference on public.pfsa_records;
create trigger pfsa_00_payment_reference before insert on public.pfsa_records
for each row when(new.kind='payment') execute function pfsa_private.validate_payment_reference();

-- Preserve the current start-choice implementation while raising its older minimum.
do $$
declare definition text;
begin
 definition:=pg_get_functiondef('pfsa_private.choose_start(text,boolean,text,text)'::regprocedure);
 if position('length(btrim(transaction_reference))<6' in definition)=0 and position('length(btrim(transaction_reference))<12' in definition)=0 then
  raise exception 'Start-choice validation has changed; review before updating.';
 end if;
 definition:=replace(definition,'length(btrim(transaction_reference))<6','length(btrim(transaction_reference))<12');
 definition:=replace(definition,'Enter the valid payment transaction reference / UTR.','Enter the valid UTR of 12 digits.');
 execute definition;
end $$;
