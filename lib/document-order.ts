import type { CloudRecord } from './pfsa-cloud';
export function orderName(pack: string) {
 if (['bundle','199','200','600'].includes(pack)) return 'Certificate of Experience + Letter of Recommendation';
 return pack === 'recommendation' ? 'Letter of Recommendation' : 'Certificate of Experience';
}
export function firstOrder(records: CloudRecord[]) {
 return records.filter(r => r.kind === 'payment').sort((a,b) => a.created_at.localeCompare(b.created_at))[0];
}
export function reviewDue(order: CloudRecord, records:CloudRecord[] = []) {
 let received=order.created_at;
 if(order.data.order_type==='early_start'){
  const submissions=records.filter(r=>r.kind==='submission'&&r.data.programme===order.data.programme&&[1,2,3,4].includes(Number(r.data.week)));
  if(new Set(submissions.map(r=>Number(r.data.week))).size!==4)return null;
  received=[received,...submissions.map(r=>r.created_at)].sort().at(-1)!;
 }
 const time = Date.parse(received);
 return Number.isFinite(time) ? new Date(time + 6 * 60 * 60 * 1000) : null;
}
export function orderReady(order: CloudRecord, docs: CloudRecord[]) {
 const published = docs.filter(d => d.data.status === 'published' && (!order.data.programme || d.data.programme === order.data.programme));
 const experience = published.some(d => ['Certificate of Experience','Letter of Experience','Letter of Completion'].includes(String(d.data.type)));
 const lor = published.some(d => d.data.type === 'Letter of Recommendation');
 return ['bundle','199','200','600'].includes(String(order.data.package)) ? experience && lor : order.data.package === 'recommendation' ? lor : experience;
}
