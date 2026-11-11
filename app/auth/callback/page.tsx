"use client";
import {useEffect,useState} from 'react';
import type {User} from '@supabase/supabase-js';
import {cloud} from '@/lib/pfsa-cloud';
import {confirmDocumentName} from '@/lib/auth-flow';
import {completePendingApplication,rememberProgramme} from '@/lib/application-flow';
import '@/components/auth-access.css';
let callbackTask:Promise<User>|undefined;
let callbackCode:string|null|undefined;
async function authenticate(){
 const params=new URLSearchParams(window.location.search);
 if(params.get('error_description'))throw Error(params.get('error_description')!);
 const selected=params.get('programme');if(selected)rememberProgramme(selected);
 const code=params.get('code');
 const{data:{session}}=await cloud.auth.getSession();
 if(code&&!session){const{error}=await cloud.auth.exchangeCodeForSession(code);if(error)throw error;}
 const{data:{user},error}=await cloud.auth.getUser();if(error)throw error;if(!user)throw Error('This sign-in link could not be used. Request a new link and open it in the same browser.');
 return user;
}
export default function Callback(){const[error,setError]=useState('');useEffect(()=>{let active=true;const code=new URLSearchParams(window.location.search).get('code');if(!callbackTask||callbackCode!==code){callbackCode=code;callbackTask=authenticate();}void callbackTask.then(async user=>{if(!active)return;if(user.app_metadata.pfsa_role==='admin'){window.location.replace('/admin');return;}const profile=await cloud.from('pfsa_profiles').select('name_confirmed_at').eq('id',user.id).maybeSingle();if(profile.error)throw profile.error;
 if(!profile.data?.name_confirmed_at){
  const hasGoogle=(user.app_metadata.providers||[]).includes('google');
  if(!hasGoogle&&user.user_metadata.name)await confirmDocumentName(String(user.user_metadata.name));
  else {window.history.replaceState(null,'','/auth/callback');window.location.replace('/onboarding');return;}
 }
 if(!active)return;await completePendingApplication(user.id);window.history.replaceState(null,'','/auth/callback');window.location.replace('/student');
 }).catch(e=>active&&setError(e.message));return()=>{active=false;};},[]);
 return <main className="pfsa-access"><section className="access-card" style={{maxWidth:480,margin:'12vh auto',background:'white',borderRadius:20}}><h2>{error?'Unable to complete sign-in':'Completing secure sign-in…'}</h2>{error&&<><p role="alert">{error}</p><a href="/login">Return to sign in</a></>}</section></main>;
}
