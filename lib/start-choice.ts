export type StartChoice = {user_id:string;programme:string;mode:'early'|'regular';start_at:string;payment_id:string|null;legacy_access:boolean};
export const A2_SUBMISSIONS_AT='2026-12-05T00:00:00+05:30';
export const A2_SUBMISSIONS_TIME=Date.parse(A2_SUBMISSIONS_AT);
export type StartOptions = {version:string;batch:string;start_at:string;submission_at?:string;early_available:boolean;early_price:number};
export function canSubmitWork(choice:StartChoice|null,now=Date.now(),batch?:string){
 if(batch==='A2/2026'&&now<A2_SUBMISSIONS_TIME)return !!choice&&choice.mode==='early'&&!!choice.payment_id;
 return !!choice && (choice.mode==='regular' || choice.legacy_access || Date.parse(choice.start_at)<=now || (choice.mode==='early' && !!choice.payment_id));
}
export function a2Countdown(now=Date.now()){
 const seconds=Math.max(0,Math.ceil((A2_SUBMISSIONS_TIME-now)/1000));
 return `${Math.floor(seconds/86400)}d ${Math.floor(seconds/3600)%24}h ${Math.floor(seconds/60)%60}m ${seconds%60}s`;
}
export function untilStart(start:string,now=Date.now()){
 const remaining=Math.max(0,Date.parse(start)-now);
 if(!Number.isFinite(remaining))return 'Schedule being confirmed';
 if(!remaining)return 'Your batch is open';
 return `${Math.floor(remaining/86400000)}d ${Math.floor(remaining/3600000)%24}h ${Math.floor(remaining/60000)%60}m`;
}
