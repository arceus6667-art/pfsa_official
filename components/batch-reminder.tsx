"use client";
import {useEffect,useState} from 'react';
import {academy} from '@/lib/academy-config';
import './start-choice.css';
export function BatchReminder(){
 const [show,setShow]=useState(false);
 useEffect(()=>{
  const key='pfsa-batch-reminder-'+academy.start;
  if(Date.now()>=Date.parse(academy.start+'T00:00:00+05:30'))return;
  try{if(sessionStorage.getItem(key))return;}catch{}
  const open=setTimeout(()=>{setShow(true);try{sessionStorage.setItem(key,'shown');}catch{}},1000);
  const close=setTimeout(()=>setShow(false),10000);
  return()=>{clearTimeout(open);clearTimeout(close);};
 },[]);
 if(!show)return null;
 return <aside className="batch-reminder" role="status" aria-label="Upcoming batch reminder"><div><strong>Your next chapter starts soon.</strong><p>Hurry! Batch {academy.batch} begins on 17 November 2026. Explore our six forensic internship domains and choose your start.</p><a href="/internships">Explore internships →</a></div><button type="button" aria-label="Dismiss batch reminder" onClick={()=>setShow(false)}>×</button></aside>;
}
