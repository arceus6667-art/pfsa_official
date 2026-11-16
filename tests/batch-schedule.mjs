import fs from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
const code=ts.transpileModule(fs.readFileSync('lib/batch-schedule.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
const {upcomingBatch}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const cases=[
 ['2026-11-16T23:59:59.999+05:30','A1/2026','2026-11-17'],
 ['2026-11-17T00:00:00+05:30','A2/2026','2026-12-15'],
 ['2026-12-14T23:59:59.999+05:30','A2/2026','2026-12-15'],
 ['2026-12-15T00:00:00+05:30','01/2027','2027-01-15'],
 ['2027-01-14T23:59:59.999+05:30','01/2027','2027-01-15'],
 ['2027-01-15T00:00:00+05:30','02/2027','2027-02-15'],
 ['2027-12-15T00:00:00+05:30','01/2028','2028-01-15'],
 ['2028-02-29T10:00:00+05:30','03/2028','2028-03-15'],
];
for(const[time,name,date]of cases){const now=Date.parse(time),batch=upcomingBatch(now);assert.equal(batch.name,name);assert.equal(batch.startDate,date);assert.ok(batch.startAt>now);}
assert.deepEqual(upcomingBatch(Date.parse('2026-12-14T18:30:00Z')),upcomingBatch(Date.parse('2026-12-15T00:00:00+05:30')));
assert.throws(()=>upcomingBatch(NaN));
console.log('PASS: exact IST cutoffs, A1/A2 transition, monthly labels, year rollover, leap year and timezone independence.');
