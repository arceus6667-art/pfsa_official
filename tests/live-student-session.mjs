// Optional live integration test. Use a dedicated disposable student account.
// Credentials are read from the environment and never written or logged.
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
const email=process.env.PFSA_QA_EMAIL,password=process.env.PFSA_QA_PASSWORD;
if(!email?.endsWith('@example.invalid')||!password)throw Error('Provide dedicated QA student credentials.');
const values=new Map(),storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
const url='https://rxiqubmkzqvspnzdasiz.supabase.co',key='sb_publishable_njEa_dFKOjPf886kpx-rQw_VJUhUk2q';
const first=createClient(url,key,{auth:{storage,persistSession:true,autoRefreshToken:false,detectSessionInUrl:false}});
const login=await first.auth.signInWithPassword({email,password});assert.ifError(login.error);const id=login.data.user.id;
// Simulate a browser waking after the locally recorded access-token expiry.
for(const [name,value] of values){if(name.endsWith('-auth-token')){const session=JSON.parse(value);session.expires_at=Math.floor(Date.now()/1000)-60;storage.setItem(name,JSON.stringify(session));}}
const resumed=createClient(url,key,{auth:{storage,persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
const restored=await resumed.auth.getSession();assert.ifError(restored.error);assert.equal(restored.data.session?.user.id,id);assert.ok(restored.data.session.expires_at>Date.now()/1000);assert.notEqual(restored.data.session.refresh_token,login.data.session.refresh_token);
const checked=await resumed.auth.getUser();assert.ifError(checked.error);assert.equal(checked.data.user.id,id);
const refreshed=await resumed.auth.refreshSession();assert.ifError(refreshed.error);assert.equal(refreshed.data.user.id,id);
const records=await resumed.from('pfsa_records').select('id,kind').eq('user_id',id);assert.ifError(records.error);
resumed.auth.stopAutoRefresh();await resumed.auth.signOut({scope:'local'});
console.log('PASS: real student sign-in, restored expired session, automatic token renewal, explicit renewal and authenticated record access.');
