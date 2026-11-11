import {cloud} from './pfsa-cloud';
import type {User} from '@supabase/supabase-js';
export function validDocumentName(value:string){const name=value.trim();return name.length>=2&&name.length<=120&&!/[\u0000-\u001f\u007f]/.test(name);}
export async function confirmDocumentName(name:string){
 if(!validDocumentName(name))throw Error('Enter your full name using 2 to 120 characters on one line.');
 const {error}=await cloud.rpc('pfsa_confirm_name',{full_name:name.trim()});if(error)throw error;
}
export async function ensureDocumentIdentity(user:User){
 if(user.app_metadata.pfsa_role==='admin')return true;
 const {data,error}=await cloud.from('pfsa_profiles').select('name,name_confirmed_at').eq('id',user.id).maybeSingle();
 if(error)throw error;
 if(data?.name_confirmed_at)return true;
 window.location.replace('/onboarding');return false;
}
