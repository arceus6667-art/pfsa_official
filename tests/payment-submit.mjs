import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import assert from 'node:assert/strict';

// Run the production checkout handler with an async runner that disables fields,
// matching AcademyCloud.run(). Disabled fields are omitted by browser FormData.
const source=fs.readFileSync('components/certification-cards.tsx','utf8');
const start=source.indexOf('onSubmit={e => {',source.indexOf('{pack &&'));
assert.ok(start>=0);
const handler=source.slice(start+'onSubmit={'.length).split('\n  }}>')[0]+'\n}';
const compiled=ts.transpileModule('globalThis.handler = ('+handler+');',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
for(const attach of [false,true]){
 const screenshot={name:'receipt.png',size:32},fields=[{name:'utr',value:'8472341823342',disabled:false},{name:'file',value:attach?screenshot:{size:0},disabled:false}];
 const writes=[],uploads=[];let pending;
 class BrowserFormData {constructor(form){this.entries=new Map(form.fields.filter(f=>!f.disabled).map(f=>[f.name,f.value]));}get(name){return this.entries.get(name)??null;}}
 const scope={FormData:BrowserFormData,accepted:true,submitting:{current:false},busy:false,order:null,pack:'bundle',programme:'mobile',userId:'fixture',PRICING_VERSION:'fixture-pricing',PAYMENT_REFERENCE_ERROR:'Enter your UTR / Payment ID.',validPaymentReference:v=>v.trim().length>0,
 cloud:{rpc:async name=>{await Promise.resolve();return {data:name==='pfsa_pricing_version'?'fixture-pricing':'one-payment-v1',error:null};}},
 run:action=>{fields.forEach(f=>f.disabled=true);pending=action();return pending;},
 uploadFile:async file=>{uploads.push(file);return 'fixture/receipt.png';},
 addRecord:async(kind,user,data)=>{writes.push({kind,user,data});return {id:'saved'};},
 documentPrice:()=>500,setSubmitted:()=>{},setPack:()=>{},setAccepted:()=>{},
 };
 vm.runInNewContext(compiled,scope);
 scope.handler({preventDefault(){},currentTarget:{fields}});
 await pending;await Promise.resolve();
 assert.equal(writes.length,1);
 assert.equal(writes[0].data.utr,'8472341823342');
 assert.equal(writes[0].data.status,'pending');
 assert.equal(writes[0].data.path,attach?'fixture/receipt.png':'');
 assert.equal(uploads.length,attach?1:0);
}
console.log('PASS: production payment handler preserves the filled reference and optional screenshot while async checks disable the form.');
