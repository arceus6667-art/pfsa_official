import type { Profile, CloudRecord } from './pfsa-cloud';
export type Batch = {id:string;name:string;start_date:string;end_date:string};
export function studentRows(profiles:Profile[],records:CloudRecord[],batch='',domain='') {
 return profiles.map(profile=>{
  const application=records.find(r=>r.kind==='application'&&r.user_id===profile.id);
  const own=records.filter(r=>r.user_id===profile.id);
  const submissions=own.filter(r=>r.kind==='submission'&&r.data.programme===application?.data.programme&&[1,2,3,4].includes(Number(r.data.week)));
  const weeks=[1,2,3,4].map(w=>submissions.find(s=>Number(s.data.week)===w));
  return {profile,application,weeks,own,submitted:weeks.filter(Boolean).length,reviewed:weeks.filter(s=>s?.data.status==='reviewed').length};
 }).filter(row=>(!batch||(batch==='unassigned'?!row.profile.cohort:row.profile.cohort===batch))&&(!domain||row.application?.data.programme===domain));
}
export function paymentAmount(record:CloudRecord) {
 const amount=Number(record.data.amount);
 if(Number.isFinite(amount)&&amount>0)return amount;
 return record.data.package==='bundle'?200:record.data.package==='199'?199:record.data.package==='600'?600:150;
}
export function csvText(rows:(string|number)[][]) {
 return '\uFEFF'+rows.map(row=>row.map(cell=>{
  let value=String(cell);if(/^[\s]*[=+@-]/.test(value))value="'"+value;
  return '"'+value.replaceAll('"','""')+'"';
 }).join(',')).join('\r\n');
}
