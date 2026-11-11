import type {CloudRecord} from './pfsa-cloud';
import {programmes} from './pfsa-data';
import {academy} from './academy-config';
const date=(value:string)=>new Date(value.length===10?value+'T00:00:00+05:30':value).toLocaleDateString('en-IN',{timeZone:'Asia/Kolkata',day:'numeric',month:'long',year:'numeric'});
async function loadImage(src:string){const image=new Image();image.src=src;await image.decode();return image;}
export async function downloadOffer(record:CloudRecord){
 if(record.kind!=='document'||record.data.type!=='Offer Letter'||record.data.status!=='published')throw Error('Only a published offer letter can be downloaded.');
 const canvas=document.createElement('canvas');canvas.width=1240;canvas.height=1754;
 const ctx=canvas.getContext('2d');if(!ctx)throw Error('Your browser cannot generate the offer PDF.');
 const [logo,msme,stamp]=await Promise.all([loadImage(academy.logo),loadImage(academy.msme),loadImage(academy.stamp)]);
 ctx.fillStyle='#fffefa';ctx.fillRect(0,0,1240,1754);
 ctx.drawImage(logo,76,48,165,170);ctx.drawImage(msme,875,75,285,134);
 ctx.fillStyle='#10223e';ctx.font='bold 48px Georgia';ctx.fillText('PRAMAAN',275,100);
 ctx.font='bold 28px Georgia';ctx.fillText('FORENSICS ACADEMY',275,147);
 ctx.font='italic 18px Georgia';ctx.fillText('Precision in Science. Integrity in Evidence.',275,185);
 ctx.font='18px Arial';ctx.fillText(academy.email,76,260);ctx.fillText(academy.phone,540,260);ctx.fillText(academy.website,890,260);
 ctx.fillStyle='#b58a3b';ctx.fillRect(76,292,1088,2);
 ctx.fillStyle='#10223e';ctx.font='bold 35px Georgia';ctx.fillText('INTERNSHIP OFFER LETTER',76,365);
 ctx.font='17px Arial';ctx.fillText('Offer Letter ID: '+record.data.number,76,412);ctx.fillText('Date: '+date(record.created_at),845,440);
 ctx.font='23px Georgia';let y=505;
 const line=(text:string,bold=false)=>{
  ctx.font=(bold?'bold ':'')+'23px Georgia';
  const tokens=text.split(/(\s+)/);let row='';
  const flush=()=>{ctx.fillText(row.trimEnd(),76,y);y+=34;row='';};
  for(const token of tokens){if(ctx.measureText(row+token).width>1088&&row.trim())flush();if(ctx.measureText(token).width>1088){for(const ch of token){if(ctx.measureText(row+ch).width>1088)flush();row+=ch;}}else row+=token;}
  if(row.trim())flush();y+=22;
 };
 line('Dear '+record.data.candidate+',',true);
 const domain=programmes.find(p=>p.id===record.data.programme)?.title||String(record.data.programme);
 line('We are pleased to offer you a four-week virtual internship in '+domain+' with '+academy.name+'.');
 line('Your internship will run from '+date(String(record.data.start_date||academy.start))+' to '+date(String(record.data.end_date||academy.end))+' as part of '+String(record.data.batch||academy.batch)+'.');
 line('This structured programme will help you develop foundational forensic knowledge, evidence documentation skills and analytical reasoning through guided independent learning.');
 line('You will complete four weekly assignments supported by domain-specific task briefs and resources. Submit your project work and the required descriptions through the student portal.');
 line('Follow the published guidance, maintain academic integrity and confidentiality, and respond professionally to assessment feedback. Completion documents and recommendations are subject to assessment and the applicable eligibility and document-service terms.');
 line('We look forward to welcoming you and supporting your learning journey.');
 line('Best regards,',true);
 if(y>1480)throw Error('The offer details are too long for this layout. Please contact academy staff.');
 ctx.drawImage(stamp,535,1460,170,170);
 ctx.strokeStyle='#10223e';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(76,1550);ctx.lineTo(470,1550);ctx.moveTo(775,1550);ctx.lineTo(1164,1550);ctx.stroke();
 ctx.fillStyle='#10223e';ctx.font='bold 24px Georgia';ctx.fillText(academy.founder,76,1590);ctx.fillText(academy.coordinator,775,1590);
 ctx.font='21px Georgia';ctx.fillText('Founder',76,1624);ctx.fillText('Programme Coordinator',775,1624);
 ctx.fillStyle='#b58a3b';ctx.fillRect(76,1680,1088,2);
 const image=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Unable to render offer.')),'image/jpeg',0.95));
 const jpeg=new Uint8Array(await image.arrayBuffer()),enc=new TextEncoder(),parts:Uint8Array[]=[],offsets=[0];let length=0;
 const push=(v:string|Uint8Array)=>{const bytes=typeof v==='string'?enc.encode(v):v;parts.push(bytes);length+=bytes.length;};
 const obj=(id:number,body:string)=>{offsets[id]=length;push(`${id} 0 obj\n${body}\nendobj\n`);};
 push('%PDF-1.4\n');obj(1,'<< /Type /Catalog /Pages 2 0 R >>');obj(2,'<< /Type /Pages /Kids [3 0 R] /Count 1 >>');obj(3,'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im 4 0 R >> >> /Contents 5 0 R >>');
 offsets[4]=length;push(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width 1240 /Height 1754 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);push(jpeg);push('\nendstream\nendobj\n');
 const draw='q 595.28 0 0 841.89 0 0 cm /Im Do Q';obj(5,`<< /Length ${draw.length} >>\nstream\n${draw}\nendstream`);
 const xref=length;push('xref\n0 6\n0000000000 65535 f \n');for(let i=1;i<=5;i++)push(String(offsets[i]).padStart(10,'0')+' 00000 n \n');push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
 const url=URL.createObjectURL(new Blob(parts as BlobPart[],{type:'application/pdf'}));const link=document.createElement('a');link.href=url;link.download=String(record.data.number)+'.pdf';link.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
}
