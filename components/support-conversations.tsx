'use client';
import {useCallback,useEffect,useMemo,useRef,useState,type FormEvent} from 'react';
import {cloud,addRecord,type CloudRecord,type Profile} from '@/lib/pfsa-cloud';
import {readAllRows} from '@/lib/admin-pagination';
import {unreadSupport,type SupportReply,type SupportRead} from '@/lib/support-thread';
import {SupportSender} from './support-sender';

export function useSupportConversations(userId:string|undefined,isAdmin:boolean){
 const [replies,setReplies]=useState<SupportReply[]>([]),[reads,setReads]=useState<SupportRead[]>([]),[error,setError]=useState('');
 const generation=useRef(0);
 const refresh=useCallback(async()=>{
  const current=++generation.current;if(!userId){setReplies([]);setReads([]);return;}
  try{const [messages,receipts]=await Promise.all([
   readAllRows<SupportReply>((from,to)=>cloud.from('pfsa_support_replies').select('*').order('created_at').order('id').range(from,to)),
   readAllRows<SupportRead>((from,to)=>cloud.from('pfsa_support_reads').select('*').eq('user_id',userId).order('ticket_id').range(from,to)),
  ]);if(current===generation.current){setReplies(messages);setReads(receipts);setError('');}}
  catch{if(current===generation.current)setError('Unable to load support replies. Please refresh and try again.');}
 },[userId]);
 useEffect(()=>{
  setReplies([]);setReads([]);setError('');if(!userId)return;void refresh();
  const sync=()=>void refresh();
  const channel=cloud.channel('pfsa-support-'+userId).on('postgres_changes',{event:'*',schema:'public',table:'pfsa_support_replies'},sync).on('postgres_changes',{event:'*',schema:'public',table:'pfsa_support_reads',filter:'user_id=eq.'+userId},sync).subscribe();
  const timer=setInterval(()=>{if(document.visibilityState==='visible')sync();},15000);window.addEventListener('focus',sync);
  return()=>{generation.current++;clearInterval(timer);window.removeEventListener('focus',sync);void cloud.removeChannel(channel);};
 },[refresh,userId]);
 const unread=useMemo(()=>unreadSupport(replies,reads,userId||'',isAdmin),[replies,reads,userId,isAdmin]);
 const send=useCallback(async(ticketId:string,body:string,id:string)=>{
  const text=body.trim();if(!text||text.length>5000)throw Error('Enter a reply between 1 and 5,000 characters.');
  const result=await cloud.from('pfsa_support_replies').insert({id,ticket_id:ticketId,body:text}).select().single();
  if(result.error){
   if(result.error.code!=='23505')throw result.error;
   const prior=await cloud.from('pfsa_support_replies').select('*').eq('id',id).single();
   if(prior.error||prior.data?.author_id!==userId||prior.data?.body!==text||prior.data?.ticket_id!==ticketId)throw result.error;
  }
  await refresh();
 },[refresh,userId]);
 const markRead=useCallback(async(ticketId:string,replyId:string)=>{const {error}=await cloud.rpc('pfsa_mark_support_read',{ticket:ticketId,through_reply:replyId});if(error)throw error;await refresh();},[refresh]);
 return {replies,unread,error,refresh,send,markRead};
}
type ConversationState=ReturnType<typeof useSupportConversations>;
const date=(value:string)=>new Date(value).toLocaleString('en-IN',{timeZone:'Asia/Kolkata',dateStyle:'medium',timeStyle:'short'});
export function SupportThread({ticket,profile,isAdmin,userId,replies,unread,onSend,onRead,onResolve}:{ticket:CloudRecord;profile?:Profile;isAdmin:boolean;userId:string;replies:SupportReply[];unread:SupportReply[];onSend:ConversationState['send'];onRead:ConversationState['markRead'];onResolve:()=>Promise<unknown>}){
 const [body,setBody]=useState(''),[sending,setSending]=useState(false),[error,setError]=useState(''),[sent,setSent]=useState('');
 const lock=useRef(false),requestId=useRef<string|null>(null);
 async function submit(e:FormEvent){e.preventDefault();if(lock.current)return;lock.current=true;setSending(true);setError('');setSent('');requestId.current??=crypto.randomUUID();
  try{await onSend(ticket.id,body,requestId.current);setBody('');requestId.current=null;setSent('Reply sent.');}catch(e){setError(e&&typeof e==='object'&&'message' in e?String(e.message):'Unable to send your reply. Your draft has been kept.');}finally{lock.current=false;setSending(false);}
 }
 return <article className="cloud-support-thread">
  {isAdmin&&<SupportSender profile={profile} userId={ticket.user_id}/>}
  <div className="support-thread-heading"><h3>{ticket.data.subject}</h3><span className="support-ticket-status">{ticket.data.status==='answered'?'Staff replied':ticket.data.status==='resolved'?'Resolved':'Open'}</span></div>
  <div className="support-message support-original"><b>{isAdmin?(profile?.name||'Student'):'You'}</b><time dateTime={ticket.created_at}>{date(ticket.created_at)} IST</time><p>{ticket.data.message}</p></div>
  <div className="support-conversation" aria-label={'Replies for '+ticket.data.subject}>
   {replies.map(reply=><div key={reply.id} className={'support-message '+(reply.author_role==='admin'?'support-staff-message':'support-student-message')}><div><b>{reply.author_id===userId?'You':reply.author_role==='admin'?'Academy staff':profile?.name||'Student'}</b><span>{reply.author_role==='admin'?'Staff reply':'Student reply'}</span><time dateTime={reply.created_at}>{date(reply.created_at)} IST</time></div><p>{reply.body}</p></div>)}
   {!replies.length&&<p className="support-empty">{isAdmin?'No replies yet. Write a response below.':'No staff reply yet. Your message is available to academy staff.'}</p>}
  </div>
  {unread.length>0&&<div className="support-unread"><strong>{unread.length} new {unread.length===1?'reply':'replies'}</strong><button type="button" disabled={sending} onClick={()=>{setError('');void onRead(ticket.id,unread[unread.length-1].id).catch(()=>setError('Unable to mark replies as read. Please try again.'));}}>Mark as read</button></div>}
  <form className="support-reply-form" onSubmit={submit}><label htmlFor={'support-reply-'+ticket.id}>{isAdmin?'Reply to student':'Reply / add more details'}</label><textarea id={'support-reply-'+ticket.id} value={body} onChange={e=>{setBody(e.target.value);requestId.current=null;setSent('');}} required maxLength={5000} rows={4} disabled={sending} placeholder={isAdmin?'Write your response. The student will see it in Support.':'Write a follow-up message for academy staff.'}/><small>{body.length}/5,000 characters</small><div className="cloud-controls"><button disabled={sending||!body.trim()}>{sending?'Sending…':'Send reply'}</button>{isAdmin&&ticket.data.status!=='resolved'&&<button type="button" disabled={sending} onClick={()=>{setError('');void onResolve().catch(()=>setError('Unable to resolve this request.'));}}>Resolve request</button>}</div><p role="status">{error||sent}</p></form>
 </article>;
}
export function SupportPanel({records,profiles,userId,isAdmin,busy,run,state}:{records:CloudRecord[];profiles:Profile[];userId:string;isAdmin:boolean;busy:boolean;run:(action:()=>Promise<unknown>,success?:string)=>Promise<void>;state:ConversationState}){
 const tickets=records.filter(r=>r.kind==='support'&&(isAdmin||r.user_id===userId));
 const ownUnread=state.unread.filter(r=>tickets.some(t=>t.id===r.ticket_id));
 return <section><h2>{isAdmin?'Support inbox':'Support & replies'}</h2><p>{isAdmin?'Read student requests and respond in the conversation below.':'Send a request and read academy replies here. Your conversations are private.'}</p>{ownUnread.length>0&&<p className="support-unread" role="status">You have {ownUnread.length} new {ownUnread.length===1?'reply':'replies'}.</p>}{state.error&&<p role="alert">{state.error}</p>}<button type="button" onClick={()=>void state.refresh()}>Refresh replies</button>
  {!isAdmin&&<form className="cloud-form" onSubmit={e=>{e.preventDefault();const form=e.currentTarget,data=new FormData(form);void run(async()=>{const subject=String(data.get('subject')||'').trim(),message=String(data.get('message')||'').trim();if(!subject||!message)throw Error('Enter a subject and message.');await addRecord('support',userId,{subject,message,status:'open'});form.reset();},'Support request sent.');}}><label>Subject<input name="subject" required maxLength={200}/></label><label>Message<textarea name="message" required maxLength={5000}/></label><button disabled={busy}>Send request</button></form>}
  {tickets.map(ticket=><SupportThread key={ticket.id} ticket={ticket} profile={profiles.find(p=>p.id===ticket.user_id)} isAdmin={isAdmin} userId={userId} replies={state.replies.filter(r=>r.ticket_id===ticket.id)} unread={state.unread.filter(r=>r.ticket_id===ticket.id)} onSend={state.send} onRead={state.markRead} onResolve={()=>run(async()=>{const {error}=await cloud.from('pfsa_records').update({data:{...ticket.data,status:'resolved'}}).eq('id',ticket.id);if(error)throw error;},'Support request resolved.')}/>)}
  {!tickets.length&&<p>No support requests yet.</p>}
 </section>;
}
