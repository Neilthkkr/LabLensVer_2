import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const start=source.indexOf('function ocrLinesFromData(');
const end=source.indexOf('async function ocrImage(',start);
assert.ok(start>=0&&end>start);
const context={};vm.createContext(context);
vm.runInContext(source.slice(start,end)+'\nthis.readLines=ocrLinesFromData',context);

test('OCR line confidence and value coordinates are normalized for report review',()=>{
  const lines=context.readLines({lines:[{
    text:'Glucose 101 mg/dL',confidence:72,
    bbox:{x0:100,y0:200,x1:900,y1:260},
    words:[{text:'101',confidence:68,bbox:{x0:400,x1:480}}]
  }]},1000,2000);
  assert.equal(lines.length,1);
  assert.equal(lines[0].confidence,0.72);
  assert.equal(lines[0].x0n,0.1);
  assert.equal(lines[0].y0n,0.1);
  assert.equal(lines[0].words[0].a,0.4);
});
