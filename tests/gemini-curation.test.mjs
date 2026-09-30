import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const source=html+'\n'+app;
const parser=fs.readFileSync(new URL('../src/core/lab-parser.mjs',import.meta.url),'utf8').replace(/^export \{[^\n]+\};\s*$/m,'');
const normText=source.match(/^function normText[^\n]*$/m)[0];
const a=source.indexOf('function curatedRowsToMetrics'),b=source.indexOf('// One entry point for every analysis path');
const context={console};
vm.createContext(context);
vm.runInContext(`${parser}\n${normText}\n${source.slice(a,b)}\nthis.map=curatedRowsToMetrics;`,context);

const TEXT=`Hemoglobin 13.5 g/dL 13.0 - 17.0\nLDL Cholesterol 132 mg/dL < 100\nGlucose Fasting 91 mg/dL`;
const map=rows=>context.map(rows,TEXT,TEXT,{sex:'male',age:34});

test('keeps rows whose source line and number are in the shared text',()=>{
  const m=map([{name:'Hemoglobin',value:13.5,unit:'g/dL',refLow:13,refHigh:17,sourceLine:'Hemoglobin 13.5 g/dL 13.0 - 17.0'}]);
  assert.equal(m.length,1);
  assert.equal(m[0].status,'normal');
  assert.equal(m[0].refFromReport,true);
  assert.equal(m[0].curatedBy,'gemini');
});

test('drops hallucinated rows: invented line, or value not on that line',()=>{
  const m=map([
    {name:'Ferritin',value:40,unit:'ng/mL',sourceLine:'Ferritin 40 ng/mL 20 - 250'},
    {name:'Hemoglobin',value:15.5,unit:'g/dL',sourceLine:'Hemoglobin 13.5 g/dL 13.0 - 17.0'}
  ]);
  assert.equal(m.length,0);
  assert.equal(m.dropped,2);
});

test('uses report range when printed, otherwise a profile/standard range, and flags status',()=>{
  const m=map([
    {name:'LDL Cholesterol',value:132,unit:'mg/dL',refHigh:100,sourceLine:'LDL Cholesterol 132 mg/dL < 100'},
    {name:'Glucose Fasting',value:91,unit:'mg/dL',sourceLine:'Glucose Fasting 91 mg/dL'}
  ]);
  assert.equal(m.find(x=>/LDL/i.test(x.name)).status,'high');
  const g=m.find(x=>/Glucose/i.test(x.name));
  assert.equal(g.refFromReport,false);
  assert.equal(g.status,'normal');
});

test('does not create the same marker twice',()=>{
  const row={name:'Hemoglobin',value:13.5,unit:'g/dL',sourceLine:'Hemoglobin 13.5 g/dL 13.0 - 17.0'};
  assert.equal(map([row,row]).length,1);
});

test('non-numeric results are flagged when they differ from the printed reference',()=>{
  const text='INFLUENZA A Reactive Non Reactive\nINFLUENZA B Non Reactive Non Reactive';
  const m=context.map([
    {name:'INFLUENZA A',value:null,valueText:'Reactive',refText:'Non Reactive',sourceLine:'INFLUENZA A Reactive Non Reactive'},
    {name:'INFLUENZA B',value:null,valueText:'Non Reactive',refText:'Non Reactive',sourceLine:'INFLUENZA B Non Reactive Non Reactive'}
  ],text,text,{sex:'male',age:16});
  assert.equal(m.find(x=>/A$/.test(x.name)).status,'high');
  assert.equal(m.find(x=>/B$/.test(x.name)).status,'normal');
  assert.match(m[0].key,/^qual:/);
});

const c1=source.indexOf('function condenseForCuration'),c2=source.indexOf('async function fetchCuratedRows');
vm.runInContext(`${source.slice(c1,c2)}\nthis.condense=condenseForCuration;this.chunk=chunkLines;`,context);
test('interpretation prose is dropped, result rows are kept',()=>{
  const prose='High sodium levels can be caused by dehydration, disorder of the adrenal glands, diarrhoea, diuretics, kidney disease, and diabetes insipidus in some people.';
  const out=context.condense(`Sodium 138 mmol/L 137 - 145\n${prose}\nHemoglobin 14.4 gm/dl 13.5-18`);
  assert.match(out,/Sodium 138/);assert.match(out,/Hemoglobin 14\.4/);assert.ok(!/adrenal/.test(out));
});
test('chunks stay under the size limit and never split a line',()=>{
  const lines=Array.from({length:500},(_,i)=>`Marker ${i} ${i} mg/dL 1 - 9`);
  const chunks=context.chunk(lines.join('\n'),2000);
  assert.ok(chunks.length>1&&chunks.every(c=>c.length<=2000));
  assert.equal(chunks.join('\n'),lines.join('\n'));
});

test('AI cannot substitute a reference number or invent units and ranges',()=>{
  const text='Glucose 101 mg/dL 70 - 99';
  const rows=[
    {name:'Glucose',value:99,unit:'mg/dL',sourceLine:text},
    {name:'Glucose',value:101,unit:'mmol/L',refLow:50,refHigh:500,sourceLine:text}
  ];
  const found=context.map(rows,text,text,{sex:'female',age:35});
  assert.equal(found.length,0);assert.equal(found.dropped,2);
});

test('AI source validation preserves decimal punctuation',()=>{
  const text='Glucose 1.2 mg/dL';
  const found=context.map([{name:'Glucose',value:12,unit:'mg/dL',sourceLine:'Glucose 1,2 mg/dL'}],text,text,{sex:'female',age:35});
  assert.equal(found.length,0);
});
