import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const start=html.indexOf('const STANDARD_RANGES =');
const end=html.indexOf('\nconst LS=',start);
assert.ok(start>=0&&end>start,'embedded parser source is discoverable');
const context={console};
vm.createContext(context);
vm.runInContext(`${html.slice(start,end)}\nthis.__parseReportText=parseReportText;`,context);
const parse=(text)=>context.__parseReportText(text,{sex:'female',age:35});

test('preserves a leading result comparator and uses the following interval',()=>{
  const rows=parse(`Test Result Unit Reference Range\nThyroid Stimulating Hormone -TSH- < 0.0083 0.35 - 4.94\nSerum, Electrochemiluminescence µIU/mL`);
  const tsh=rows.find(row=>row.key==='tsh');
  assert.ok(tsh);
  assert.equal(tsh.value,0.0083);
  assert.equal(tsh.qualifier,'<');
  assert.equal(tsh.min,0.35);
  assert.equal(tsh.max,4.94);
  assert.equal(tsh.status,'low');
  assert.match(tsh.unit,/µIU\/mL/i);
});

test('reassembles a wrapped result label when it identifies a more specific analyte',()=>{
  const rows=parse(`Test Result Unit Reference Range\nMean Corpuscular Hemoglobin 32.2 31.5 - 34.5\nConcentration -MCHC- Calculated g/dL`);
  const mchc=rows.find(row=>row.key==='mean corpuscular hemoglobin concentration');
  assert.ok(mchc);
  assert.equal(mchc.value,32.2);
  assert.equal(mchc.unit,'g/dL');
});

test('rejects reference-table labels and narrative fragments',()=>{
  const rows=parse(`Test Result Unit Reference Range\nHigh ≥ 240\ndiagnose or monitor these conditions. Low urea levels are also discussed`);
  assert.equal(rows.length,0);
});

test('does not contaminate RDW with a following classifier block',()=>{
  const rows=parse(`Test Result Unit Reference Range\nRed Cell Distribution Width -RDW- CV 13.0 11.6 - 14\nMentzer Index 17.7\nBeta Thalassemia trait: < 14\nIron deficiency anaemia: >= 14`);
  const rdw=rows.find(row=>row.key==='red cell distribution width');
  assert.ok(rdw);
  assert.equal(rdw.status,'normal');
  assert.equal(rdw.min,11.6);
  assert.equal(rdw.max,14);
});

test('reconstructs wrapped ratio labels and limit references',()=>{
  const rows=parse(`Test Result Unit Reference Range
High-Density Lipoprotein/Low-Density 0.3 > 0.4
Lipoprotein -HDL/LDL- Ratio Ratio
Alanine Transaminase -ALT- 19 -50
LDH, UV Kinetic U/L`);
  const ratio=rows.find(row=>row.key==='hdl ldl ratio');
  assert.ok(ratio);
  assert.equal(ratio.value,0.3);
  assert.equal(ratio.status,'low');
  const alt=rows.find(row=>row.key==='sgpt');
  assert.ok(alt);
  assert.equal(alt.value,19);
  assert.equal(alt.max,50);
});

test('preserves urine microscopy result intervals',()=>{
  const rows=parse(`Urine Complete Analysis
Urine, Microscopic Examination
Pus Cells 2-3 0-5
Automated Morphological Microscopy /hpf
Red Blood Cells -RBC- 1-2 0-2
Automated Morphological Microscopy /hpf`);
  const pus=rows.find(row=>row.key==='urine pus cells');
  const rbc=rows.find(row=>row.key==='urine rbc');
  assert.equal(pus.valueText,'2-3');
  assert.equal(pus.status,'normal');
  assert.equal(rbc.valueText,'1-2');
  assert.equal(rbc.unit,'/hpf');
});

test('uses the full vitamin-D tier block instead of the deficient cutoff alone',()=>{
  const rows=parse(`Test Result Unit Reference Range
Vitamin D, 25-Hydroxy 27.5 Deficient: < 20
Insufficient: 20-30
Sufficient: 30-100
Toxicity: >100
Serum CMIA ng/mL`);
  const vitaminD=rows.find(row=>row.key==='vitamin d');
  assert.ok(vitaminD);
  assert.equal(vitaminD.value,27.5);
  assert.equal(vitaminD.status,'low');
  assert.equal(vitaminD.min,30);
  assert.equal(vitaminD.max,100);
});

test('joins split analyte rows without reading a digit from the method name',()=>{
  const rows=parse(`Test Results Units Biological Reference
Aspartate Aminotransferase -AST-
Multipoint-Rate/UV with Pyridoxal-5- 23 U/L 14 - 36
Alkaline Phosphatase -ALP-
Multipoint-Rate/UV with Pyridoxal-5- 108 U/L 38 - 126`);
  const ast=rows.find(row=>row.key==='sgot');
  const alp=rows.find(row=>row.key==='alkaline phosphatase');
  assert.equal(ast.value,23);
  assert.equal(ast.min,14);
  assert.equal(alp.value,108);
  assert.equal(alp.min,38);
});

test('extracts split protein, NLR, and superscript platelet-count rows',()=>{
  const rows=parse(`Test Results Units Biological Reference
Protein
6.5 g/dL 6 - 8.3
Neutrophil Lymphocyte Ratio -NLR-
2.4 Ratio 1 - 3
Platelet Count
155 10³/μL 150 - 450`);
  assert.equal(rows.find(row=>row.key==='total protein')?.value,6.5);
  assert.equal(rows.find(row=>row.key==='neutrophil lymphocyte ratio')?.value,2.4);
  assert.equal(rows.find(row=>row.key==='platelet')?.value,155);
});

test('does not parse explanatory ratio prose as a result',()=>{
  const rows=parse(`AST/ALT Ratio > 2-1 is indicative of liver disease.
AST/ALT Ratio < 1-1 indicates another clinical pattern.`);
  assert.equal(rows.length,0);
});

test('method text such as "Flow Cytometry" or "Fluoride Plasma" is never read as the fL unit',()=>{
  const rows=parse(`Test Result Biological Reference Interval\nEosinophils 6.8 1 - 6\nFlow Cytometry %\nGlucose, Fasting 138 70 - 99\nFluoride Plasma,Glucose Oxidase-Peroxidase GODPOD mg/dL`);
  assert.equal(rows.find(r=>/eosinophils/i.test(r.name)).unit,'%');
  assert.equal(rows.find(r=>/glucose/i.test(r.name)).unit,'mg/dL');
});
