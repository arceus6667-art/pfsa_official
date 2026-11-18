import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import assert from 'node:assert/strict';

const compile = code => ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const scope={exports:{}};
vm.runInNewContext(compile(fs.readFileSync('lib/workspace-session.ts','utf8')),scope);
const {createWorkspaceRefreshGate,verifiedWorkspaceUser}=scope.exports;
const user={id:'qa-student'};
const networkError=Object.assign(new Error('Temporary auth connection failure'),{status:503});
await assert.rejects(()=>verifiedWorkspaceUser({getUser:async()=>({data:{user:null},error:networkError})}),e=>e===networkError);
assert.equal(await verifiedWorkspaceUser({getUser:async()=>({data:{user},error:null})}),user);
assert.equal(await verifiedWorkspaceUser({getUser:async()=>({data:{user:null},error:null})}),null);

// Exercise the production refresh and action runners, not copies of their logic.
const source=fs.readFileSync('components/academy-cloud.tsx','utf8');
const ast=ts.createSourceFile('academy.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
function variable(name){let found;function visit(node){if(ts.isVariableDeclaration(node)&&node.name.getText(ast)===name)found=node.initializer.getText(ast);ts.forEachChild(node,visit);}visit(ast);assert.ok(found,name);return found;}
let current=user,loading=false,notice='',writes=0;
const state={cloud:{auth:{getUser:async()=>({data:{user:null},error:networkError})}},verifiedWorkspaceUser,refreshGate:createWorkspaceRefreshGate(),
 setUser:value=>{current=value;writes++;},setLoading:value=>loading=value,setNotice:value=>notice=value,setBusy:()=>{},page:'student'};
vm.runInNewContext(compile('globalThis.refresh = '+variable('refresh')+';'),state);
await assert.rejects(()=>state.refresh(),e=>e===networkError);
assert.equal(current,user,'A temporary auth failure must retain the signed-in UI');assert.equal(writes,0);
vm.runInNewContext(compile('globalThis.run = '+variable('run')+';'),state);
let saved=false;
await state.run(async()=>{saved=true;},'Payment submitted for review.');
assert.equal(saved,true);assert.match(notice,/Payment submitted for review/);assert.match(notice,/change is saved/);assert.equal(current,user);
await state.run(async()=>{throw Error('Payment was not saved');});assert.equal(notice,'Payment was not saved');

// A focus/realtime burst shares one in-flight request. Sign-out wins over it.
const gate=createWorkspaceRefreshGate();let release,calls=0,committed=false;
const delayed=gate.run(async isCurrent=>{calls++;await new Promise(resolve=>release=resolve);if(isCurrent())committed=true;});
assert.equal(gate.run(async()=>{calls++;}),delayed);await Promise.resolve();assert.equal(calls,1);
gate.invalidate();release();await delayed;assert.equal(committed,false);
await gate.run(async isCurrent=>assert.equal(isCurrent(),true));
let releaseRead,read=0;
const first=gate.run(async()=>{read++;await new Promise(resolve=>releaseRead=resolve);});
const afterWrite=gate.run(async()=>{read++;},true);
await Promise.resolve();assert.equal(read,1);releaseRead();await Promise.all([first,afterWrite]);assert.equal(read,2,'Saving must read fresh data after an older in-flight request');
console.log('PASS: auth outage preserves the workspace; saved payment survives refresh failure; refreshes coalesce; explicit sign-out discards stale responses.');
