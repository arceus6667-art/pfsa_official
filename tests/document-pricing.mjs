import ts from 'typescript';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const load=async path=>import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText).toString('base64'));
const pricing=await load('lib/document-pricing.ts');
const report=await load('lib/admin-report.ts');
assert.equal(pricing.documentPrice('experience'),350);
assert.equal(pricing.documentPrice('recommendation'),300);
assert.equal(pricing.documentPrice('bundle'),500);
assert.equal(pricing.BUNDLE_SAVINGS,150);
for(const amount of [150,199,200,350,300,500,600]) {
 assert.equal(report.paymentAmount({data:{package:'bundle',amount,status:'pending'}}),amount);
}
assert.equal(report.paymentAmount({data:{package:'bundle'}}),200);
assert.equal(report.paymentAmount({data:{package:'experience'}}),150);
console.log('13 pricing assertions passed: current fees, bundle saving and original order totals.');
