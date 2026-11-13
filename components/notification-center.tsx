"use client";
import {useCallback,useEffect,useRef,useState,type FormEvent} from 'react';
import {Bell,X,CheckCheck} from 'lucide-react';
import {cloud,type Profile} from '@/lib/pfsa-cloud';
import {programmes} from '@/lib/pfsa-data';
import {readAllRows} from '@/lib/admin-pagination';
import './notification-center.css';

export type Notification={id:string;category:string;title:string;body:string;audience:string;target_programme:string|null;target_batch:string|null;target_user:string|null;published:boolean;created_at:string};
type Receipt={notification_id:string;read_at:string|null;dismissed_at:string|null};
export function useNotifications(userId:string|undefined,isAdmin:boolean){
 const [items,setItems]=useState<Notification[]>([]),[receipts,setReceipts]=useState<Receipt[]>([]),[error,setError]=useState('');
 const generation=useRef(0);
 const refresh=useCallback(async()=>{
  if(!userId)return;
  const request=++generation.current;
  try{
   if(!isAdmin){const {error}=await cloud.rpc('pfsa_ensure_programme_notice');if(error)throw error;}
   const [next,reads]=await Promise.all([
    readAllRows<Notification>((from,to)=>{let query=cloud.from('pfsa_notifications').select('*').order('created_at',{ascending:false}).order('id');if(isAdmin)query=query.eq('category','announcement');return query.range(from,to);}),
    isAdmin?Promise.resolve([]):readAllRows<Receipt>((from,to)=>cloud.from('pfsa_notification_receipts').select('notification_id,read_at,dismissed_at').eq('user_id',userId).order('notification_id').range(from,to))
   ]);
   if(request===generation.current){setItems(next);setReceipts(reads);setError('');}
  }catch(e){if(request===generation.current)setError(e instanceof Error?e.message:'Unable to load notifications. Please refresh.');}
 },[userId,isAdmin]);
 useEffect(()=>{
  setItems([]);setReceipts([]);setError('');if(!userId)return;
  void refresh();
  const channel=cloud.channel('pfsa-notices-'+userId).on('postgres_changes',{event:'*',schema:'public',table:'pfsa_notifications'},()=>void refresh()).on('postgres_changes',{event:'*',schema:'public',table:'pfsa_notification_receipts',filter:'user_id=eq.'+userId},()=>void refresh()).subscribe();
  const focus=()=>{if(document.visibilityState==='visible')void refresh();};
  window.addEventListener('focus',focus);const timer=setInterval(focus,30000);
  return()=>{generation.current++;clearInterval(timer);window.removeEventListener('focus',focus);void cloud.removeChannel(channel);};
 },[userId,refresh]);
 const act=async(id:string,dismiss=false)=>{const {error}=await cloud.rpc('pfsa_notification_action',{notice:id,dismiss});if(error)throw new Error(error.message);await refresh();};
 const markAll=async()=>{const {error}=await cloud.rpc('pfsa_mark_notifications_read');if(error)throw new Error(error.message);await refresh();};
 return {items,receipts,error,refresh,act,markAll};
}
type State=ReturnType<typeof useNotifications>;
export function NotificationBell({state,onTasks}:{state:State;onTasks:()=>void}){
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const host=useRef<HTMLDivElement>(null),button=useRef<HTMLButtonElement>(null);
 const unread=state.items.filter(n=>!state.receipts.some(r=>r.notification_id===n.id&&r.read_at));
 const floating=unread.find(n=>!state.receipts.some(r=>r.notification_id===n.id&&r.dismissed_at));
 useEffect(()=>{if(!open)return;const close=(e:KeyboardEvent)=>{if(e.key==='Escape'){setOpen(false);button.current?.focus();}};const outside=(e:PointerEvent)=>{if(!host.current?.contains(e.target as Node))setOpen(false);};document.addEventListener('keydown',close);document.addEventListener('pointerdown',outside);return()=>{document.removeEventListener('keydown',close);document.removeEventListener('pointerdown',outside);};},[open]);
 async function perform(action:()=>Promise<unknown>){setBusy(true);setError('');try{await action();}catch(e){setError(e instanceof Error?e.message:'Please try again.');}finally{setBusy(false);}}
 return <div className="pfsa-notification-host" ref={host}>
  <button ref={button} className="pfsa-bell" aria-label={'Notifications'+(unread.length?', '+unread.length+' unread':'')} aria-expanded={open} aria-controls="pfsa-notification-panel" onClick={()=>setOpen(!open)}><Bell size={21}/>{unread.length>0&&<span>{unread.length>99?'99+':unread.length}</span>}</button>
  {open&&<div id="pfsa-notification-panel" className="pfsa-notification-panel" role="region" aria-label="Notifications">
   <div className="pfsa-notification-title"><h2>Notifications</h2><button aria-label="Close notifications" onClick={()=>{setOpen(false);button.current?.focus();}}><X size={18}/></button></div>
   <div className="pfsa-notification-tools"><button disabled={busy||!unread.length} onClick={()=>void perform(state.markAll)}><CheckCheck size={15}/> Mark all as read</button><button onClick={()=>void state.refresh()}>Refresh</button></div>
   {(error||state.error)&&<p role="alert">{error||state.error}</p>}
   {!state.items.length&&!state.error&&<p className="pfsa-notification-empty">You're all caught up. Academy announcements will appear here.</p>}
   <div className="pfsa-notification-list">{state.items.map(n=>{const fresh=unread.some(item=>item.id===n.id);return <article key={n.id} className={fresh?'is-unread':''}><small>{fresh?'NEW · ':''}{new Date(n.created_at).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'})}</small><h3>{n.title}</h3><p>{n.body}</p><div className="pfsa-notification-tools">{fresh&&<button disabled={busy} onClick={()=>void perform(()=>state.act(n.id))}>Mark as read</button>}{n.category==='programme_start'&&<button disabled={busy} onClick={()=>{onTasks();setOpen(false);void perform(()=>state.act(n.id,true));}}>Open tasks →</button>}</div></article>;})}</div>
  </div>}
  {!open&&floating&&<aside className="pfsa-notification-toast" role="status"><div className="pfsa-notification-title"><span className="pfsa-notification-eyebrow"><Bell size={16}/> ACADEMY UPDATE</span><button aria-label="Dismiss notification" disabled={busy} onClick={()=>void perform(()=>state.act(floating.id,true))}><X size={18}/></button></div><h3>{floating.title}</h3><p>{floating.body}</p>{error&&<p role="alert">{error}</p>}<button onClick={()=>setOpen(true)}>View notifications →</button></aside>}
 </div>;
}

export function AdminNotifications({state,profiles,userId}:{state:State;profiles:Profile[];userId:string}){
 const [audience,setAudience]=useState('all'),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const batches=Array.from(new Set(profiles.map(p=>p.cohort).filter(Boolean))).sort();
 async function publish(e:FormEvent<HTMLFormElement>){e.preventDefault();const form=e.currentTarget,data=new FormData(form);setBusy(true);setMessage('');try{
  const title=String(data.get('title')||'').trim(),body=String(data.get('body')||'').trim(),target=String(data.get('target')||'');if(!title||!body||(audience!=='all'&&!target))throw new Error('Enter the title, message and recipient.');
  const {error}=await cloud.from('pfsa_notifications').insert({category:'announcement',title,body,audience,created_by:userId,target_programme:audience==='domain'?target:null,target_batch:audience==='batch'?target:null,target_user:audience==='student'?target:null});if(error)throw error;
  form.reset();setAudience('all');setMessage('Notification published. Students can see it in their notification bell.');await state.refresh();
 }catch(e){setMessage(e instanceof Error?e.message:'Unable to publish notification.');}finally{setBusy(false);}}
 async function archive(id:string){setBusy(true);setMessage('');try{const {error}=await cloud.from('pfsa_notifications').update({published:false}).eq('id',id);if(error)throw error;await state.refresh();setMessage('Announcement archived.');}catch{setMessage('Unable to archive. Please try again.');}finally{setBusy(false);}}
 return <><section><h2>Publish a notification</h2><p>Send an academy update to all students or a selected group. Students receive an unread badge and a floating notice when they open their workspace.</p><form className="cloud-form" onSubmit={publish}>
  <label>Title<input name="title" maxLength={160} required placeholder="Announcement title"/></label><label>Audience<select value={audience} onChange={e=>setAudience(e.target.value)}><option value="all">All students</option><option value="domain">A domain</option><option value="batch">A batch</option><option value="student">One student</option></select></label>
  {audience!=='all'&&<label>Recipient<select name="target" required key={audience}><option value="">Select recipient</option>{audience==='domain'?programmes.map(p=><option key={p.id} value={p.id}>{p.title}</option>):audience==='batch'?batches.map(b=><option key={b} value={b}>{b}</option>):profiles.map(p=><option key={p.id} value={p.id}>{p.name||'Student'} · {p.email}</option>)}</select></label>}
  <label className="pfsa-notification-message">Message<textarea name="body" maxLength={3000} rows={5} required placeholder="Write the update students should receive…"/></label><button disabled={busy}>{busy?'Please wait…':'Publish notification'}</button>
 </form><p role="status">{message||state.error}</p></section><section><h2>Announcement history</h2>{!state.items.length&&<p>No announcements have been published yet.</p>}{state.items.map(n=><article className="pfsa-admin-notice" key={n.id}><small>{n.published?'Published':'Archived'} · {new Date(n.created_at).toLocaleDateString('en-IN')} · {n.audience==='domain'?(programmes.find(p=>p.id===n.target_programme)?.title||n.target_programme):n.audience==='batch'?n.target_batch:n.audience==='student'?(profiles.find(p=>p.id===n.target_user)?.email||'Selected student'):'All students'}</small><h3>{n.title}</h3><p>{n.body}</p>{n.published&&<button disabled={busy} onClick={()=>void archive(n.id)}>Archive announcement</button>}</article>)}</section></>;
}
