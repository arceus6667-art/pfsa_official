import { createClient } from '@supabase/supabase-js';
export const cloud = createClient('https://ndtlhzrkonordpntyphe.supabase.co','sb_publishable_tGuLrcx7jPvArHSfwfmOUw_Gz0yCGpl');
export type RecordKind = 'application'|'submission'|'resource'|'task'|'payment'|'document'|'support';
export type CloudRecord = {id:string;kind:RecordKind;user_id:string|null;data:Record<string,string|number>;created_at:string};
export type Profile = {id:string;name:string;email:string;phone:string;city:string;linkedin:string;github:string;cohort:string;start_date:string|null};
export async function uploadFile(file:File,userId:string) {
 if(file.size>10*1024*1024) throw new Error('Choose a file smaller than 10 MB.');
 if(!/\.(pdf|docx?|zip|png|jpe?g|webp)$/i.test(file.name)) throw new Error('Supported files: PDF, Word, ZIP, PNG and JPG.');
 const path=`${userId}/${crypto.randomUUID()}/${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;
 const {error}=await cloud.storage.from('pfsa-files').upload(path,file,{upsert:false});
 if(error) throw error;
 return path;
}
export async function openFile(path:string) {
 const {data,error}=await cloud.storage.from('pfsa-files').createSignedUrl(path,120);
 if(error) throw error;
 window.open(data.signedUrl,'_blank','noopener,noreferrer');
}
export async function addRecord(kind:RecordKind,userId:string|null,data:CloudRecord['data']) {
 const result=await cloud.from('pfsa_records').insert({kind,user_id:userId,data}).select().single();
 if(result.error) throw result.error;
 return result.data as CloudRecord;
}
