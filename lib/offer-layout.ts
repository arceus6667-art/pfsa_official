import type {CloudRecord} from './pfsa-cloud';
import {academy} from './academy-config';
import {programmes} from './pfsa-data';
export type OfferRun={text:string;bold?:boolean};
const plain=(text:string):OfferRun=>({text});
const bold=(text:string):OfferRun=>({text,bold:true});
export const offerDate=(value:string)=>new Date(value.length===10?value+'T00:00:00+05:30':value).toLocaleDateString('en-IN',{timeZone:'Asia/Kolkata',day:'numeric',month:'long',year:'numeric'});
export function offerParagraphs(record:CloudRecord):OfferRun[][]{
 const data=record.data,domain=programmes.find(p=>p.id===data.programme)?.title||String(data.programme);
 return [
  [plain('Dear '),bold(String(data.candidate)),plain(',')],
  [plain('We are pleased to offer you a four-week virtual internship in '),bold(domain),plain(' with Pramaan Forensics Academy. Your internship will run from '),bold(offerDate(String(data.start_date||academy.start))),plain(' to '),bold(offerDate(String(data.end_date||academy.end))),plain(' as part of '),bold(String(data.batch||academy.batch)),plain('.')],
  [plain('This structured programme will help you develop foundational forensic knowledge, evidence documentation skills and analytical reasoning through guided independent learning.')],
  [plain('You will complete four weekly assignments supported by domain-specific task briefs and resources. Submit your project work and the required descriptions through the student portal.')],
  [plain('Throughout the programme, you are expected to follow the published guidance, maintain academic integrity and confidentiality, and respond professionally to assessment feedback.')],
  [plain('Successful completion will be determined through assessment of the required submissions. Completion documents and recommendations are subject to the applicable eligibility and document-service terms.')],
  [plain('We look forward to welcoming you and supporting your learning journey.')],
  [bold('Best regards,')],
 ];
}
export function offerBodyLayout(ctx:CanvasRenderingContext2D,paragraphs:OfferRun[][]){
 const width=1100,start=620,target=1390;
 for(let font=27.5;font>=23;font-=0.5){
  const lineHeight=font*1.43;
  const groups=paragraphs.map(runs=>{
   const lines:OfferRun[][]=[[]];let used=0;
   for(const run of runs)for(let token of run.text.match(/\S+\s*|\s+/gu)||[]){
    ctx.font=(run.bold?'bold ':'')+font+'px "Times New Roman", serif';
    const tokenWidth=ctx.measureText(token).width;
    if(used+tokenWidth>width&&used>0){lines.push([]);used=0;token=token.trimStart();}
    if(ctx.measureText(token).width>width){for(const char of token){const part=ctx.measureText(char).width;if(used+part>width){lines.push([]);used=0;}lines[lines.length-1].push({...run,text:char});used+=part;}}
    else {lines[lines.length-1].push({...run,text:token});used+=ctx.measureText(token).width;}
   }
   return lines;
  });
  const lineCount=groups.reduce((n,lines)=>n+lines.length,0);
  const desiredGap=(target-start-(lineCount-1)*lineHeight)/(groups.length-1);
  if(desiredGap<20&&font>23)continue;
  const gap=Math.max(18,Math.min(42,desiredGap));
  const end=start+(lineCount-1)*lineHeight+(groups.length-1)*gap;
  if(end>1450)throw Error('The offer details are too long for this layout. Contact academy staff.');
  return {font,lineHeight,gap,start,end,groups};
 }
 throw Error('Unable to fit offer details.');
}
