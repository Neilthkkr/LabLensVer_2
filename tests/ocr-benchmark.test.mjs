import test from 'node:test';
import assert from 'node:assert/strict';
import { numericTokens, scoreMetrics, scoreNumericTokens } from '../src/ocr/benchmark.mjs';

test('numeric scoring preserves medical decimals and inequalities', () => {
  assert.deepEqual(numericTokens('TSH 2.45, eGFR >= 90, LDL 101'), ['2.45', '>=90', '101']);
  const score = scoreNumericTokens('Hb 12.2 Platelets 268000', 'Hb 12.2 Platelets 268000');
  assert.equal(score.recall, 1);
  assert.equal(score.precision, 1);
});

test('high-confidence wrong values are counted separately', () => {
  const expected = [{ name: 'Haemoglobin', value: '12.2', unit: 'g/dL', referenceRange: '12-15' }];
  const actual = [{ name: 'Haemoglobin', value: '17.2', unit: 'g/dL', referenceRange: '12-15', confidence: 0.99 }];
  const score = scoreMetrics(expected, actual);
  assert.equal(score.exactValueRate, 0);
  assert.equal(score.dangerousConfidentErrors, 1);
});

test('repeated analytes require distinct predictions and extra confident rows count',()=>{
  const expected=[
    {name:'Glucose',value:'101',unit:'mg/dL',referenceRange:'70-99',pageNumber:1},
    {name:'Glucose',value:'104',unit:'mg/dL',referenceRange:'70-99',pageNumber:2}
  ];
  const actual=[
    {name:'Glucose',value:'104',unit:'mg/dL',referenceRange:'70-99',pageNumber:2,confidence:.98},
    {name:'Glucose',value:'101',unit:'mg/dL',referenceRange:'70-99',pageNumber:1,confidence:.98},
    {name:'Glucose',value:'999',unit:'mg/dL',referenceRange:'70-99',pageNumber:1,confidence:.99}
  ];
  const score=scoreMetrics(expected,actual);
  assert.equal(score.matched,2);
  assert.equal(score.exactValueRate,1);
  assert.equal(score.falsePositive,1);
  assert.equal(score.dangerousConfidentErrors,1);
});
