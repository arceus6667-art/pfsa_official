alter policy pfsa_record_create on public.pfsa_records with check(
 (select auth.jwt()->'app_metadata'->>'pfsa_role')='admin' or (
 user_id=(select auth.uid()) and (
 (kind='application' and data->>'status'='approved') or
 (kind='submission' and data->>'status'='submitted' and not(data?'marks') and data->>'week' in ('1','2','3','4')) or
 (kind='payment' and data->>'status'='pending' and data->>'package' in ('experience','recommendation','bundle')) or
 (kind='support' and data->>'status'='open')
 )));
