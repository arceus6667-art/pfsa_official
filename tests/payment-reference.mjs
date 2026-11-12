import ts from 'typescript';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const code=ts.transpileModule(fs.readFileSync('lib/payment-reference.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
const {validPaymentReference,PAYMENT_REFERENCE_ERROR}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
for(const value of ['','12345678901','pay_ABC1234','123456 89012','12345678901\n2','x'.repeat(101)])assert.equal(validPaymentReference(value),false,value);
for(const value of ['123456789012','1234567890123','pay_ABC1234567890',' 123456789012 ','x'.repeat(100)])assert.equal(validPaymentReference(value),true,value);
assert.equal(PAYMENT_REFERENCE_ERROR,'Enter the valid UTR of 12 digits.');
console.log('12 payment reference checks passed: minimum, trim, payment IDs, whitespace and upper limit.');
