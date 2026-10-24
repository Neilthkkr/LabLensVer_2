import test from 'node:test';
import assert from 'node:assert/strict';
import {markerChanges,profileOverview} from '../src/core/family-summary.mjs';

const rep=(date,metrics)=>({date,metrics:metrics.map(([key,name,value,status,unit])=>({key,name,value,status,unit}))});

test('flags improvement back into range',()=>{
  const c=markerChanges([rep('2026-01-01',[['a1c','HbA1c',7.2,'high','%']]),rep('2026-06-01',[['a1c','HbA1c',5.6,'normal','%']])]);
  assert.equal(c[0].trend,'improved');assert.match(c[0].text,/now in range/);assert.equal(c[0].detail,'7.2 → 5.6 %');
});
test('flags worsening and ranks it first',()=>{
  const c=markerChanges([
    rep('2026-01-01',[['a','A',10,'high'],['b','B',5,'high']]),
    rep('2026-06-01',[['a','A',8,'high'],['b','B',5,'normal']]),
    rep('2026-09-01',[['a','A',14,'high'],['b','B',5,'high']])]);
  assert.equal(c[0].trend,'worsened');
});
test('ignores single readings, tiny changes and in-range stability',()=>{
  assert.deepEqual(markerChanges([rep('2026-01-01',[['a','A',1,'normal']])]),[]);
  assert.deepEqual(markerChanges([rep('2026-01-01',[['a','A',100,'high']]),rep('2026-02-01',[['a','A',101,'high']])]),[]);
  assert.deepEqual(markerChanges([rep('2026-01-01',[['a','A',1,'normal']]),rep('2026-02-01',[['a','A',2,'normal']])]),[]);
});
test('overview counts the latest report only',()=>{
  const o=profileOverview([rep('2026-01-01',[['a','A',9,'high']]),rep('2026-06-01',[['a','A',5,'normal'],['b','B',1,'low']])]);
  assert.equal(o.count,2);assert.equal(o.total,2);assert.equal(o.outOfRange,1);assert.equal(o.latestDate,'2026-06-01');
  assert.deepEqual(profileOverview([]),{count:0,latest:null,changes:[]});
});

import {latestReadings} from '../src/core/family-summary.mjs';
test('latest readings keep newest value per marker, out-of-range first',()=>{
  const r=latestReadings([rep('2026-01-01',[['a','A',9,'high','x'],['b','B',1,'normal']]),rep('2026-06-01',[['a','A',5,'normal','x']]),rep('2026-06-02',[['c','C',3,'low']])]);
  assert.deepEqual(r.map(x=>x.key),['c','a','b']);
  assert.equal(r[1].value,'5');assert.equal(r[1].prior,'9 x');assert.equal(r[1].date,'2026-06-01');
});
