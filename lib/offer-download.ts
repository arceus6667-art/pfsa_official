import type {CloudRecord} from './pfsa-cloud';
import {academy} from './academy-config';
import {offerBodyLayout,offerParagraphs,offerDate} from './offer-layout';
async function loadImage(src:string){const image=new Image();image.src=src;await image.decode();return image;}
export async function renderOfferCanvas(record:CloudRecord){
 if(record.kind!=='document'||record.data.type!=='Offer Letter'||record.data.status!=='published')throw Error('Only a published offer letter can be downloaded.');
 const canvas=document.createElement('canvas');canvas.width=1240;canvas.height=1754;
 const ctx=canvas.getContext('2d');if(!ctx)throw Error('Your browser cannot generate the offer PDF.');
 const [template,stamp,founderSignature,coordinatorSignature]=await Promise.all([
  loadImage('/assets/documents/offer-template-preview.png'),loadImage(academy.stamp),
  loadImage(academy.founderSignature),loadImage(academy.coordinatorSignature),
 ]);
 ctx.fillStyle='#fff';ctx.fillRect(0,0,1240,1754);
 // Use the exact approved header artwork, including the logo, icons and MSME mark.
 ctx.drawImage(template,0,0,1054,316,0,0,1240,316*1754/1492);
 ctx.fillStyle='#10223e';ctx.font='22px "Times New Roman", serif';
 ctx.fillText('Offer Letter ID:',70,418);ctx.font='18px Arial';ctx.fillText(String(record.data.number),222,418);
 ctx.font='23px "Times New Roman", serif';ctx.textAlign='right';ctx.fillText('Date: '+offerDate(record.created_at),1172,418);ctx.textAlign='left';
 // Copy the approved heading and its navy/gold underline without recreating the font.
 ctx.drawImage(template,0,392,1054,89,0,392*1754/1492,1240,89*1754/1492);
 const layout=offerBodyLayout(ctx,offerParagraphs(record));let y=layout.start;
 for(let i=0;i<layout.groups.length;i++){
  for(const runs of layout.groups[i]){
   let x=70;
   for(const run of runs){ctx.font=(run.bold?'bold ':'')+layout.font+'px "Times New Roman", serif';ctx.fillText(run.text,x,y);x+=ctx.measureText(run.text).width;}
   y+=layout.lineHeight;
  }
  if(i<layout.groups.length-1)y+=layout.gap;
 }
 // Sign the current rendering of both existing and newly issued records; keep their stored identity and dates.
 const signatureY=Math.max(1515,layout.end+140);
 ctx.drawImage(stamp,495,signatureY-72,200,200);
 // Crop transparent margins only and fit without stretching the original handwriting.
 const signature=(image:HTMLImageElement,crop:number[],x:number,width:number)=>{
  const [sx,sy,sw,sh]=crop;const scale=Math.min(width/sw,110/sh);
  const w=sw*scale,h=sh*scale;
  ctx.drawImage(image,sx,sy,sw,sh,x+(width-w)/2,signatureY-12-h,w,h);
 };
 signature(founderSignature,[76,112,2022,526],70,345);
 signature(coordinatorSignature,[33,6,1779,854],755,418);
 ctx.strokeStyle='#10223e';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(70,signatureY);ctx.lineTo(415,signatureY);ctx.moveTo(755,signatureY);ctx.lineTo(1173,signatureY);ctx.stroke();
 ctx.fillStyle='#10223e';ctx.font='bold 26px "Times New Roman", serif';ctx.fillText(academy.founder,70,signatureY+45);ctx.fillText(academy.coordinator,755,signatureY+45);
 ctx.font='italic 25px "Times New Roman", serif';ctx.fillText('Founder',70,signatureY+79);ctx.fillText('Programme Coordinator',755,signatureY+79);
 ctx.fillStyle='#b58a3b';ctx.fillRect(70,1709,1104,2);
 return canvas;
}
export async function downloadOffer(record:CloudRecord){
 const canvas=await renderOfferCanvas(record);
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
