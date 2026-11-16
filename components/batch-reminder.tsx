"use client";
import {useEffect,useState} from 'react';
import {upcomingBatch} from '@/lib/batch-schedule';
import './start-choice.css';
export function BatchReminder(){
 const [show,setShow]=useState(false);
 const [batch,setBatch]=useState(()=>upcomingBatch());
 useEffect(()=>{
  const next=upcomingBatch();setBatch(next);
  const key='pfsa-batch-reminder-'+next.startDate;
  try{if(sessionStorage.getItem(key))return;}catch{}
  const open=setTimeout(()=>{setShow(true);try{sessionStorage.setItem(key,'shown');}catch{}},1000);
  const close=setTimeout(()=>setShow(false),10000);
  return()=>{clearTimeout(open);clearTimeout(close);};
 },[]);
 if(!show)return null;
 return <aside className="batch-reminder" role="status" aria-label="Upcoming batch reminder"><div><strong>Your next chapter starts soon.</strong><p>Hurry! Batch {batch.name} begins on {new Date(batch.startAt).toLocaleDateString('en-IN',{timeZone:'Asia/Kolkata',day:'numeric',month:'long',year:'numeric'})}. Explore our six forensic internship domains and choose your start.</p><a href="/internships">Explore internships →</a></div><button type="button" aria-label="Dismiss batch reminder" onClick={()=>setShow(false)}>×</button></aside>;
}
