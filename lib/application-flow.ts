import {cloud,addRecord} from './pfsa-cloud';
import {programmes} from './pfsa-data';
const KEY='pfsa-pending-programme';
export function rememberProgramme(id:string){if(programmes.some(p=>p.id===id))localStorage.setItem(KEY,id);}
export async function completePendingApplication(userId:string){
 const selected=localStorage.getItem(KEY);
 const {data:existing,error}=await cloud.from('pfsa_records').select('id').eq('kind','application').eq('user_id',userId).maybeSingle();
 if(error)throw error;
 if(!existing&&selected&&programmes.some(p=>p.id===selected)){
  try{await addRecord('application',userId,{programme:selected,status:'pending'});}catch(error){if((error as {code?:string}).code!=='23505')throw error;}
 }
 if(existing||selected)localStorage.removeItem(KEY);
}
export {countWords} from './word-count';
