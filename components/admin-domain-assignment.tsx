'use client';
import {useEffect,useRef,useState} from 'react';
import {cloud,type CloudRecord,type Profile} from '@/lib/pfsa-cloud';
import {programmes} from '@/lib/pfsa-data';
export function AdminDomainAssignment({profile,application,busy,onSaved}:{profile:Profile;application?:CloudRecord;busy:boolean;onSaved:()=>Promise<void>}){
 const current=String(application?.data.programme||'');const [selected,setSelected]=useState(current),[reason,setReason]=useState(''),[saving,setSaving]=useState(false),[notice,setNotice]=useState('');const lock=useRef(false);
 useEffect(()=>{setSelected(current);setReason('');},[current,profile.id]);
 const currentTitle=programmes.find(p=>p.id===current)?.title||'Not assigned';
 return <form className="admin-domain-assignment" onSubmit={async e=>{e.preventDefault();if(lock.current||selected===current)return;lock.current=true;setSaving(true);setNotice('');try{
  const {error}=await cloud.rpc('pfsa_admin_change_domain',{candidate:profile.id,new_programme:selected,expected_programme:current,change_reason:reason.trim()});if(error)throw error;
  setReason('');setNotice('Domain saved. The student portal and offer letter have been updated.');try{await onSaved();}catch{setNotice('Domain saved. Refresh the page to load the updated record.');}
 }catch(e){setNotice(e&&typeof e==='object'&&'message' in e?String(e.message):'Unable to change this domain. Please refresh and try again.');}finally{lock.current=false;setSaving(false);}}}>
 <h3>Internship domain</h3><p>Current domain: <strong>{currentTitle}</strong></p>
 <label htmlFor={'candidate-domain-'+profile.id}>Assign / change domain for {profile.name}</label><select id={'candidate-domain-'+profile.id} value={selected} onChange={e=>{setSelected(e.target.value);setNotice('');}} required disabled={busy||saving}><option value="">Select a domain</option>{programmes.map(p=><option key={p.id} value={p.id}>{p.title}</option>)}</select>
 <p className="admin-domain-help">The student will see this domain’s tasks and resources. Previous submissions remain in their original domain. The batch and existing payment are preserved, and the updated offer can be downloaded again.</p>
 <label htmlFor={'candidate-domain-reason-'+profile.id}>Reason for domain change</label><textarea id={'candidate-domain-reason-'+profile.id} value={reason} onChange={e=>setReason(e.target.value)} minLength={3} maxLength={500} required disabled={busy||saving} placeholder="For example: student requested a domain correction" rows={2}/>
 <button disabled={busy||saving||!selected||selected===current||reason.trim().length<3}>{saving?'Saving domain…':current?'Save domain change':'Assign domain'}</button><p role="status">{notice}</p>
 </form>;
}
