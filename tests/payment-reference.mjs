import ts from 'typescript';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const code=ts.transpileModule(fs.readFileSync('lib/payment-reference.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
const {validPaymentReference,PAYMENT_REFERENCE_ERROR}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
for(const value of ['',' ','\t\n','x'.repeat(101)])assert.equal(validPaymentReference(value),false,value);
for(const value of ['1','AB1','ID 7','pay_ABC1234','12345678901',' 123 ','x'.repeat(100)])assert.equal(validPaymentReference(value),true,value);
assert.equal(PAYMENT_REFERENCE_ERROR,'Enter your UTR / Payment ID.');
console.log('Payment reference checks passed: short references, spaces, empty rejection and upper limit.');
