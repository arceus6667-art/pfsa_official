export type StartChoice = {user_id:string;programme:string;mode:'early'|'regular';start_at:string;payment_id:string|null;legacy_access:boolean};
export type StartOptions = {version:string;batch:string;start_at:string;early_available:boolean;early_price:number};
export function canSubmitWork(choice:StartChoice|null,now=Date.now()){
 return !!choice && (choice.legacy_access || Date.parse(choice.start_at)<=now || (choice.mode==='early' && !!choice.payment_id));
}
export function untilStart(start:string,now=Date.now()){
 const remaining=Math.max(0,Date.parse(start)-now);
 if(!Number.isFinite(remaining))return 'Schedule being confirmed';
 if(!remaining)return 'Your batch is open';
 return `${Math.floor(remaining/86400000)}d ${Math.floor(remaining/3600000)%24}h ${Math.floor(remaining/60000)%60}m`;
}
