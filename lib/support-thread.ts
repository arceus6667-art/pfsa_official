export type SupportReply={id:string;ticket_id:string;author_id:string;author_role:'admin'|'student';body:string;created_at:string};
export type SupportRead={ticket_id:string;user_id:string;last_read_at:string};
export function unreadSupport(replies:SupportReply[],reads:SupportRead[],userId:string,isAdmin:boolean){
 const seen=new Map(reads.filter(r=>r.user_id===userId).map(r=>[r.ticket_id,Date.parse(r.last_read_at)]));
 return replies.filter(r=>r.author_role===(isAdmin?'student':'admin')&&r.author_id!==userId&&Date.parse(r.created_at)>(seen.get(r.ticket_id)||0));
}
