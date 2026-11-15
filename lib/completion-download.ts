import type {CloudRecord} from './pfsa-cloud';
import {academy} from './academy-config';
import {programmes} from './pfsa-data';
async function image(src:string){const img=new Image();img.src=src;await img.decode();return img;}
export async function renderCompletionCanvas(record:CloudRecord){
 if(record.kind!=='document'||record.data.status!=='published'||!['Certificate of Experience','Letter of Recommendation','Letter of Experience','Letter of Completion'].includes(String(record.data.type)))throw Error('This document is not available for download.');
 const canvas=document.createElement('canvas');canvas.width=1240;canvas.height=1754;const context=canvas.getContext('2d');if(!context)throw Error('Unable to render document.');const ctx:CanvasRenderingContext2D=context;
 const [header,stamp,founder,coordinator]=await Promise.all([image('/assets/documents/offer-template-preview.png'),image(academy.stamp),image(academy.founderSignature),image(academy.coordinatorSignature)]);
 ctx.fillStyle='#fff';ctx.fillRect(0,0,1240,1754);ctx.drawImage(header,0,0,1054,316,0,0,1240,372);
 const data=record.data,lor=data.type==='Letter of Recommendation',name=String(data.candidate||''),domain=programmes.find(p=>p.id===data.programme)?.title||String(data.programme),date=new Date(record.created_at).toLocaleDateString('en-IN',{timeZone:'Asia/Kolkata',dateStyle:'long'});
 ctx.fillStyle='#142542';ctx.font='17px Arial';ctx.fillText('Document ID: '+String(data.number),70,420);ctx.textAlign='right';ctx.fillText('Issued: '+date,1170,452);ctx.textAlign='left';
 ctx.font='bold 44px Georgia';ctx.fillText(lor?'LETTER OF RECOMMENDATION':'CERTIFICATE OF EXPERIENCE',70,540);ctx.fillStyle='#b78c3d';ctx.fillRect(70,568,1100,3);
 let y=650;function paragraph(text:string,bold=false){ctx.fillStyle='#142542';ctx.font=(bold?'bold ':'')+'27px Georgia';let line='';for(const word of text.split(/\s+/)){const next=line?line+' '+word:word;if(ctx.measureText(next).width>1090&&line){ctx.fillText(line,70,y);y+=42;line=word;}else line=next;}if(line){ctx.fillText(line,70,y);y+=42;}y+=24;}
 paragraph(lor?'TO WHOM IT MAY CONCERN':'THIS IS TO CERTIFY THAT',true);paragraph(name,true);
 paragraph(lor?`We are pleased to recommend ${name}, who has completed all four weekly project submissions in the ${domain} virtual internship programme with ${academy.name}.`:`${name} has completed the four weekly project submissions in the ${domain} virtual internship programme with ${academy.name}.`);
 paragraph(`Batch: ${String(data.batch||academy.batch)}. The structured programme covers guided independent learning, practical project work and forensic documentation.`);
 paragraph(lor?'We recommend the candidate for opportunities to continue developing their knowledge and practical skills in this field. We wish them success in their future academic and professional endeavours.':'This certificate records the candidate’s participation and completion of the required project submissions. We appreciate their commitment to learning and wish them continued success.');
 paragraph('Issued by Pramaan Forensics Academy following confirmation of programme requirements.');
 const sy=1490;ctx.drawImage(stamp,515,sy-65,180,180);
 function signature(img:HTMLImageElement,crop:number[],x:number,w:number){const[sx,yy,sw,sh]=crop,scale=Math.min(w/sw,105/sh);ctx.drawImage(img,sx,yy,sw,sh,x+(w-sw*scale)/2,sy-sh*scale-12,sw*scale,sh*scale);}
 signature(founder,[76,112,2022,526],70,360);signature(coordinator,[33,6,1779,854],780,390);
 ctx.strokeStyle='#142542';ctx.beginPath();ctx.moveTo(70,sy);ctx.lineTo(430,sy);ctx.moveTo(780,sy);ctx.lineTo(1170,sy);ctx.stroke();ctx.fillStyle='#142542';ctx.font='bold 26px Georgia';ctx.fillText(academy.founder,70,sy+45);ctx.fillText(academy.coordinator,780,sy+45);ctx.font='italic 24px Georgia';ctx.fillText('Founder',70,sy+80);ctx.fillText('Programme Coordinator',780,sy+80);
 ctx.font='18px Arial';ctx.fillText('Verify by document number at https://prammanforensics.in/verify',70,1670);ctx.fillStyle='#b78c3d';ctx.fillRect(70,1709,1100,2);return canvas;
}
