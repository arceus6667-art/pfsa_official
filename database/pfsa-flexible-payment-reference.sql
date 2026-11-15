create or replace function public.pfsa_valid_payment_reference(value text) returns boolean language sql immutable set search_path='' as $$
 select length(btrim(coalesce(value,''))) between 1 and 100 and coalesce(value,'') ~ '[^[:space:]]'
$$;
create or replace function pfsa_private.validate_payment_reference() returns trigger language plpgsql set search_path='' as $$
begin
 if not public.pfsa_valid_payment_reference(new.data->>'utr') then raise exception 'Enter your UTR / Payment ID.' using errcode='22023';end if;
 new.data:=new.data||jsonb_build_object('utr',btrim(new.data->>'utr'));return new;
end $$;
do $$ declare definition text;old_check text:=$old$if length(btrim(transaction_reference))<12 or length(btrim(transaction_reference))>100 then raise exception 'Enter the valid UTR of 12 digits.';end if;$old$;
begin
 definition:=pg_get_functiondef('pfsa_private.choose_start(text,boolean,text,text)'::regprocedure);
 if position(old_check in definition)=0 then raise exception 'Early Start payment validation has changed; inspect before applying.';end if;
 definition:=replace(definition,old_check,$new$if not public.pfsa_valid_payment_reference(transaction_reference) then raise exception 'Enter your UTR / Payment ID.';end if;$new$);
 execute definition;
end $$;
