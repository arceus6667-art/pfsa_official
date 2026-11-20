import fs from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
const source=file=>ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/^import .*?;\s*$/gm,'').replace(/export /g,'');
const academy={batch:'A1/2026',email:'admin@prammanforensics.com',website:'prammanforensics.in'};
const programmes=[['computer-cyber','Computer & Cyber Forensics'],['mobile','Mobile Device Forensics'],['network','Network Forensics'],['cloud','Cloud Forensics'],['database','Database Forensics'],['iot','IoT & Digital Device Forensics']].map(([id,title])=>({id,title}));
let drawn=[],text=[],canvas,blob;const names=[];
const ctx={font:'',textAlign:'left',fillStyle:'',fillRect(){},drawImage(...args){drawn.push(args);},measureText(value){return {width:value.length*Number((this.font.match(/([\d.]+)px/)||[])[1]||20)*.6};},fillText(value,x,y,maxWidth){text.push({value,x,y,maxWidth,font:this.font,align:this.textAlign,width:this.measureText(value).width});}};
const doc={createElement:tag=>tag==='canvas'?(canvas={width:0,height:0,getContext:()=>ctx,toBlob:fn=>fn(new Blob([new Uint8Array([255,216,255,217])]))}):{click(){names.push(this.download);}}};
const experience=new Function('academy','programmes','document','Image',source('lib/experience-certificate.ts')+';return {isExperienceCertificate,experienceFields,renderExperienceCanvas};')(academy,programmes,doc,class{async decode(){}});
const base={id:'existing-record',kind:'document',user_id:'11111111-2222-4333-8444-555555555555',created_at:'2026-11-15T21:51:24.515564Z',data:{type:'Certificate of Experience',status:'published',candidate:'Previously Issued Student',number:'PFSA-EXP-2026-EXISTING-NUMBER',programme:'cloud',batch:'A1/2026',start_date:'2026-11-17',end_date:'2026-12-14'}};
const before=JSON.stringify(base),fields=experience.experienceFields(base);
assert.equal(fields.issueDate,'16 November 2026');assert.equal(fields.duration,'4 Weeks (28 Days)');assert.equal(fields.studentId,base.user_id);
for(const domain of programmes){for(const type of ['Certificate of Experience','Letter of Experience','Letter of Completion']){
 drawn=[];text=[];const record={...base,data:{...base.data,programme:domain.id,type,path:'legacy-upload.pdf'}};
 await experience.renderExperienceCanvas(record);assert.equal(canvas.width,1491);assert.equal(canvas.height,1055);assert.equal(drawn.length,1);assert.equal(drawn[0][0].src,'/assets/documents/experience-certificate-template-v3.png');
 assert.ok(text.some(t=>t.value===domain.title));assert.ok(text.some(t=>t.value===fields.issueDate));assert.ok(text.some(t=>t.value===base.user_id));assert.ok(text.some(t=>t.value.includes(base.data.number)));
 const domainText=text.find(t=>t.value===domain.title);assert.ok(domainText.x>=442&&domainText.x+domainText.width<=754);assert.ok(text.some(t=>t.value===academy.email));assert.ok(text.some(t=>t.value===academy.website));
}}
for(const name of ['Very Long '.repeat(12).trim(),'W'.repeat(120)]){text=[];await experience.renderExperienceCanvas({...base,data:{...base.data,candidate:name}});const lines=text.filter(t=>t.x===746&&t.y>=420&&t.y<=455);assert.ok(lines.length<=2);assert.ok(lines.every(t=>t.width<=780));assert.equal(lines.map(t=>t.value).join('').replace(/\s/g,''),name.replace(/\s/g,''));}
assert.equal(JSON.stringify(base),before,'Historical document identity must not change');
await assert.rejects(()=>experience.renderExperienceCanvas({...base,data:{...base.data,status:'draft'}}));
assert.equal(experience.isExperienceCertificate({...base,data:{...base.data,type:'Letter of Recommendation'}}),false);
const download=new Function('academy','document','Image','URL','setTimeout','renderCompletionCanvas',source('lib/offer-download.ts')+';return downloadOffer;')(academy,doc,class{}, {createObjectURL:value=>{blob=value;return 'blob:qa';},revokeObjectURL(){}},()=>{},experience.renderExperienceCanvas);
await download(base);const pdf=await blob.text();assert.match(pdf,/\/MediaBox \[0 0 841\.89 595\.28\]/);assert.match(pdf,/\/Width 1491 \/Height 1055/);assert.equal(names.at(-1),base.data.number+'.pdf');
const png=fs.readFileSync('public/assets/documents/experience-certificate-template-v3.png');assert.equal(png.readUInt32BE(16),1491);assert.equal(png.readUInt32BE(20),1055);
console.log('PASS: six domains, three historical experience labels, old uploaded PDFs, preserved IDs/dates, long names, correct landscape PDF dimensions and official contact details.');
