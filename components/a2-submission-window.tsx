"use client";
import {useRef,useState,type FormEvent} from 'react';
import {cloud,uploadFile,type CloudRecord} from '@/lib/pfsa-cloud';
import {A2_SUBMISSIONS_TIME,a2Countdown,type StartChoice} from '@/lib/start-choice';
import {firstOrder} from '@/lib/document-order';
import {validPaymentReference,PAYMENT_REFERENCE_ERROR} from '@/lib/payment-reference';
import {PaymentReferenceInput} from './payment-reference-input';
import './a2-submission-window.css';

export function A2SubmissionStatus({choice,now,onEarlyBird}:{choice:StartChoice|null;now:number;onEarlyBird:()=>void}){
 const early=choice?.mode==='early'&&!!choice.payment_id,open=now>=A2_SUBMISSIONS_TIME;
 return <section className="a2-submission-status" aria-label="A2 submission schedule"><small>A2/2026 · SUBMISSION SCHEDULE</small><h2>{early?'Early Bird · submissions open':open?'Your A2 submissions are open':'Your submissions open on 5 December 2026'}</h2>{!early&&!open?<><p>You can start submitting your weekly tasks from <strong>5 December 2026, 12:00 AM IST</strong>.</p><div className="a2-countdown" role="timer" aria-label="Time until regular submissions open" aria-live="off">{a2Countdown(now)}</div><p>Study your domain resources while you wait, or choose Early Bird to submit before this date.</p><button onClick={onEarlyBird}>View Early Bird · ₹400 →</button></>:<p>{early?'Your Early Bird payment details are recorded. You can submit all four weekly tasks now. Payment is reviewed separately; no second payment is needed.':'You can now submit all four weekly tasks from Tasks.'}</p>}</section>;
}

export function A2EarlyBirdCard({userId,records,choice,now,onDone}:{userId:string;records:CloudRecord[];choice:StartChoice|null;now:number;onDone:()=>Promise<void>}){
 const [accepted,setAccepted]=useState(false),[expanded,setExpanded]=useState(false),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const [saved,setSaved]=useState(false);
 const lock=useRef(false),order=firstOrder(records),early=choice?.mode==='early'&&!!choice.payment_id;
 if(now>=A2_SUBMISSIONS_TIME)return null;
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(lock.current||!accepted||order||!choice)return;
  const data=new FormData(e.currentTarget);lock.current=true;setBusy(true);setNotice('');
  try{
   const reference=String(data.get('utr')||'').trim();if(!validPaymentReference(reference))throw Error(PAYMENT_REFERENCE_ERROR);
   const file=data.get('file') as File|null,path=file?.size?await uploadFile(file,userId):'';
   const result=await cloud.rpc('pfsa_upgrade_a2_early_start',{terms_accepted:true,transaction_reference:reference,screenshot_path:path});if(result.error)throw result.error;
   setSaved(true);setExpanded(false);setAccepted(false);setNotice('Early Bird is recorded. Do not pay again. Your early submission access is opening.');
   try{await onDone();}catch{setNotice('Early Bird is saved. Use Refresh when your connection returns; do not pay again.');}
  }catch(e){setNotice(e&&typeof e==='object'&&'message'in e?String(e.message):'Unable to submit. Please retry or contact Support.');}
  finally{lock.current=false;setBusy(false);}
 }
 return <article className="a2-early-bird"><small>A2/2026 ONLY · OPTIONAL EARLY ACCESS</small><h2>Early Bird · <s>₹650</s> ₹400</h2><p>Submit before 5 December 2026 and get the Certificate of Experience + Letter of Recommendation bundle after all four weekly submissions and payment approval.</p>{early||saved?<strong>Your Early Bird is already recorded. No additional payment is needed.</strong>:order?<p role="status">You already have a document order. Do not pay again. Contact Support if you need help with early access.</p>:<><p>Regular submissions open free on 5 December 2026 at 12:00 AM IST. Early Bird is optional.</p><button disabled={busy||!choice} onClick={()=>setExpanded(!expanded)}>{expanded?'Close Early Bird checkout':'Choose Early Bird · ₹400'}</button>{expanded&&<form className="cloud-form" onSubmit={submit}><div className="cloud-payment-terms"><h3>Before you pay</h3><p>One order only. Submitting your UTR / Payment ID opens early submission access; it does not verify payment. After all four submissions and staff payment approval, your ordered documents are issued in this portal and sent to your registered email. Allow an estimated six hours after all submissions and payment details are received; further verification may take longer.</p><label className="cloud-consent"><input type="checkbox" required checked={accepted} disabled={busy} onChange={e=>setAccepted(e.target.checked)}/><span>I accept the ₹400 Early Bird bundle, manual payment and project review, estimated six-hour processing, and email/portal delivery terms.</span></label></div>{accepted&&<><p>Pay ₹400 once using the academy GPay / UPI QR, then submit your reference.</p><img className="cloud-qr" src="/assets/payment-qr.png" alt="Academy UPI payment QR"/><PaymentReferenceInput disabled={busy}/><label>Payment screenshot (optional)<input type="file" name="file" accept=".png,.jpg,.jpeg,.pdf" disabled={busy}/></label></>}<button disabled={busy||!accepted}>{busy?'Saving Early Bird…':'Submit Early Bird payment & open submissions'}</button></form>}</>}<p role="status">{notice}</p></article>;
}
