import type {CloudRecord} from './pfsa-cloud';
import {programmes} from './pfsa-data';
import {academy} from './academy-config';

export const EXPERIENCE_TEMPLATE='/assets/documents/experience-certificate-template-v3.png';
export function isExperienceCertificate(record:CloudRecord){
 return record.kind==='document'&&['Certificate of Experience','Letter of Experience','Letter of Completion'].includes(String(record.data.type));
}
export function experienceFields(record:CloudRecord){
 const d=record.data,start=Date.parse(String(d.start_date||'')+'T00:00:00Z'),end=Date.parse(String(d.end_date||'')+'T00:00:00Z');
 const days=Number.isFinite(start)&&Number.isFinite(end)&&end>=start?Math.round((end-start)/86400000)+1:28;
 const duration=days%7===0?`${days/7} Weeks (${days} Days)`:`${days} Days`;
 return {name:String(d.candidate||''),domain:programmes.find(p=>p.id===d.programme)?.title||String(d.programme||''),batch:String(d.batch||academy.batch),studentId:String(d.student_id||record.user_id||d.number),number:String(d.number),duration,issueDate:new Date(record.created_at).toLocaleDateString('en-IN',{timeZone:'Asia/Kolkata',day:'numeric',month:'long',year:'numeric'})};
}
function fitText(ctx:CanvasRenderingContext2D,text:string,x:number,y:number,width:number,size:number,family='Georgia',bold=false){
 ctx.font=`${bold?'bold ':''}${size}px ${family}`;
 while(ctx.measureText(text).width>width&&size>10){size-=.5;ctx.font=`${bold?'bold ':''}${size}px ${family}`;}
 ctx.fillText(text,x,y);
}
function nameLines(ctx:CanvasRenderingContext2D,name:string,size:number){
 ctx.font=`bold ${size}px Georgia`;
 const lines:string[]=[];let line='';
 for(const word of name.split(/\s+/)){
  if(ctx.measureText(line?(line+' '+word):word).width<=780){line=line?line+' '+word:word;continue;}
  if(line){lines.push(line);line='';}
  for(const char of word){if(ctx.measureText(line+char).width>780&&line){lines.push(line);line='';}line+=char;}
 }
 if(line)lines.push(line);return lines;
}
export async function renderExperienceCanvas(record:CloudRecord){
 if(!isExperienceCertificate(record)||record.data.status!=='published')throw Error('This certificate is not available for download.');
 const fields=experienceFields(record),canvas=document.createElement('canvas');canvas.width=1491;canvas.height=1055;
 const ctx=canvas.getContext('2d');if(!ctx)throw Error('Unable to render certificate.');
 const background=new Image();background.src=EXPERIENCE_TEMPLATE;await background.decode();
 ctx.drawImage(background,0,0,1491,1055);ctx.fillStyle='#080e32';ctx.textAlign='center';
 let size=42;ctx.font=`bold ${size}px Georgia`;
 while(ctx.measureText(fields.name).width>780&&size>28){size--;ctx.font=`bold ${size}px Georgia`;}
 if(ctx.measureText(fields.name).width<=780)ctx.fillText(fields.name,746,444);
 else{
  let lines=nameLines(ctx,fields.name,26);size=26;
  while(lines.length>2&&size>16){size--;lines=nameLines(ctx,fields.name,size);}
  lines.forEach((line,i)=>ctx.fillText(line,746,lines.length===1?444:425+i*27));
 }
 ctx.textAlign='left';
 fitText(ctx,fields.domain,442,638,311,24);
 fitText(ctx,fields.batch,414,681,337,25);
 fitText(ctx,fields.studentId,386,723,367,17,'Arial');
 fitText(ctx,fields.duration,1067,638,253,23);
 fitText(ctx,fields.issueDate,1072,705,248,23);
 // Retain the existing verification number separately from the student's ID.
 ctx.textAlign='center';fitText(ctx,'Certificate ID: '+fields.number,746,240,850,14,'Arial');
 // Keep the established academy contact details and working verification URL.
 ctx.fillStyle='#fff';ctx.fillRect(330,947,307,34);ctx.fillRect(1016,947,224,34);
 ctx.fillStyle='#080e32';ctx.textAlign='left';
 fitText(ctx,academy.email,333,972,301,25,'"Times New Roman"');
 fitText(ctx,academy.website,1018,972,218,25,'"Times New Roman"');
 ctx.fillStyle='#00192d';ctx.fillRect(495,997,505,26);ctx.fillStyle='#fff';ctx.textAlign='center';ctx.font='italic 21px "Times New Roman"';
 ctx.fillText('Verify this certificate at https://'+academy.website+'/verify',746,1019,500);
 return canvas;
}
