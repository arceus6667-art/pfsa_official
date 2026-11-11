import type {CloudRecord} from './pfsa-cloud';
import {programmes} from './pfsa-data';
// Render the published offer record, including Unicode names, into a downloadable PDF.
export async function downloadOffer(record:CloudRecord){
 const canvas=document.createElement('canvas');canvas.width=1240;canvas.height=1754;
 const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Your browser cannot generate the offer PDF.');
 ctx.fillStyle='#fff';ctx.fillRect(0,0,1240,1754);ctx.fillStyle='#142542';
 ctx.font='bold 34px Arial';ctx.fillText('PRAMAAN FORENSICS ACADEMY',100,130);
 ctx.fillStyle='#b88b3d';ctx.fillRect(100,165,1040,4);ctx.font='bold 32px Arial';ctx.fillText('INTERNSHIP OFFER LETTER',100,260);
 ctx.fillStyle='#142542';ctx.font='24px Arial';let y=340;
 const line=(text:string)=>{const words=text.split(/\s+/);let row='';for(const word of words){if(ctx.measureText(row+word).width>1020){ctx.fillText(row,100,y);y+=38;row='';}row+=word+' ';}if(row){ctx.fillText(row,100,y);y+=38;}y+=16;};
 line('Offer number: '+record.data.number);line('Issued: '+new Date(record.created_at).toLocaleDateString('en-IN'));line('Dear '+record.data.candidate+',');
 line('You are enrolled in the '+(programmes.find(p=>p.id===record.data.programme)?.title||record.data.programme)+' virtual internship programme at Pramaan Forensics Academy.');
 line('Programme duration: four weeks. Your weekly task guides and deadlines are available in your student workspace.');
 line('Complete and submit all four weekly projects, along with the required descriptions. Completion documents are subject to assessment and the applicable document-service fees.');
 line('This is a system-issued training offer. It is not an employment offer or a guarantee of a recommendation.');
 line('Verify this offer at: '+window.location.origin+'/verify');
 line('Enter document number: '+record.data.number);
 ctx.font='20px Arial';ctx.fillStyle='#69778d';ctx.fillText('Precision in Science. Integrity in Evidence.',100,1600);
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
