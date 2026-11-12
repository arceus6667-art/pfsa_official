-- Future orders only: retain all existing recorded amounts and payment protections.
create or replace function public.pfsa_pricing_version()
returns text language sql immutable set search_path = ''
as $$ select 'PFSA-PRICING-2026-11-12-V2'::text $$;
grant execute on function public.pfsa_pricing_version() to anon, authenticated;

create or replace function public.pfsa_document_price(package_name text)
returns integer language sql immutable set search_path = ''
as $$ select case package_name when 'experience' then 350 when 'recommendation' then 300 when 'bundle' then 500 else null end $$;
grant execute on function public.pfsa_document_price(text) to anon, authenticated;

create or replace function pfsa_private.enforce_document_pricing()
returns trigger language plpgsql set search_path = '' as $$
declare price integer;
begin
 if coalesce(new.data->>'price_version','') <> public.pfsa_pricing_version() then
  raise exception 'Document prices have changed. Refresh the portal and confirm the current price before paying.';
 end if;
 price := public.pfsa_document_price(new.data->>'package');
 if price is null then raise exception 'Select a valid document package.'; end if;
 new.data := new.data || jsonb_build_object('amount',price,'price_version',public.pfsa_pricing_version());
 return new;
end $$;
-- PostgreSQL runs BEFORE triggers alphabetically; apply after the legacy validator.
drop trigger if exists pfsa_z_payment_pricing on public.pfsa_records;
create trigger pfsa_z_payment_pricing before insert on public.pfsa_records
for each row when (new.kind='payment') execute function pfsa_private.enforce_document_pricing();

select 'PFSA pricing update complete' as status,
 public.pfsa_document_price('experience') as experience,
 public.pfsa_document_price('recommendation') as recommendation,
 public.pfsa_document_price('bundle') as bundle;
