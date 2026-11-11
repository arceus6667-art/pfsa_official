"use client";
import {useEffect,useState} from 'react';
import {cloud} from '@/lib/pfsa-cloud';
import {programmes} from '@/lib/pfsa-data';
import {rememberProgramme,completePendingApplication} from '@/lib/application-flow';
import '@/components/academy-cloud.css';
export default function Apply(){const[error,setError]=useState('');useEffect(()=>{let alive=true;async function finish(){const selected=new URLSearchParams(window.location.search).get('programme');if(!selected||!programmes.some(p=>p.id===selected))throw new Error('Select a valid internship domain.');rememberProgramme(selected);const {data:{user}}=await cloud.auth.getUser();if(!user){window.location.replace('/login?programme='+encodeURIComponent(selected));return;}if(user.app_metadata.pfsa_role==='admin'){window.location.replace('/admin');return;}if(!await completePendingApplication(user.id))return;if(alive)window.location.replace('/student');}finish().catch(e=>alive&&setError(e.message));return()=>{alive=false;};},[]);return <main className="cloud-auth"><section><h1>{error?'Unable to enrol':'Opening your selected internship…'}</h1>{error&&<><p role="alert">{error}</p><a href="/internships">Return to internships</a></>}</section></main>}
