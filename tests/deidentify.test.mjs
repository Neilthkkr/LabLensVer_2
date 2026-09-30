import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {deidentify,demographics}=createRequire(import.meta.url)('../src/privacy/deidentify.js');

const REPORT=`Patient Name : Rahul Sharma
Age/Sex: 34 / Male
Ref by: Dr. Anil Mehta
Mobile 9876543210  rahul@example.com
Sample collected 12/03/2025
UHID 20250312345
Hemoglobin 13.5 g/dL 13.0 - 17.0
Mr. Rahul Sharma report
Platelet Count 250 10^3/uL 150 - 410
Contact +971 50 123 4567
LDL Cholesterol 132 mg/dL < 100
Verified by Dr. S Nair`;

test('identity and contact details never survive de-identification',()=>{
  const {text}=deidentify(REPORT,{names:['Rahul Sharma']});
  for(const leak of ['Rahul','Sharma','Mehta','Nair','9876543210','example.com','20250312345','971','12/03/2025'])
    assert.ok(!text.includes(leak),`leaked ${leak}`);
});

test('result rows and their reference ranges are preserved',()=>{
  const {text}=deidentify(REPORT,{names:['Rahul Sharma']});
  assert.match(text,/Hemoglobin 13\.5 g\/dL 13\.0 - 17\.0/);
  assert.match(text,/Platelet Count 250 10\^3\/uL 150 - 410/);
  assert.match(text,/LDL Cholesterol 132 mg\/dL < 100/);
});

test('only whole-number age and male/female sex are shared',()=>{
  assert.deepEqual(demographics(34.6,'male'),{age:35,sex:'male'});
  assert.deepEqual(demographics(null,'other'),{age:null,sex:null});
  assert.deepEqual(demographics(200,'female'),{age:null,sex:'female'});
});

test('reference ranges survive: decimals, wide integers and mixed separators are not dates or phone numbers',()=>{
  const rows=['Hemoglobin 14.4 gm/dl 13.5-18','RDW (CV) 13.3 % 11.60-14','Platelet Count 162000 /uL 150000-450000','MPV 9.5 fl 7.2-11.7','Total W.B.C Count 4970 / cumm 4000-11000','CRP 43.85 mg/L 0-06'];
  const {text}=deidentify(rows.join('\n'));
  assert.equal(text,rows.join('\n'));
});

test('real dates and landline-style numbers are still removed',()=>{
  const {text}=deidentify('Collected 04/09/2026 09:01\nReported 04-Aug-2026\nHemoglobin 12 g/dL 12-15\nTel 022-12345678 ext\nSampled 2026-08-04');
  assert.ok(!/04\/09\/2026|04-Aug-2026|2026-08-04|12345678/.test(text),text);
  assert.match(text,/Hemoglobin 12 g\/dL 12-15/);
});

test('report and registration date header lines are dropped even with a leading colon',()=>{
  const {text}=deidentify(': Registration Date : 04-Aug-2026 01.37 PM\nHemoglobin 14.4 gm/dl 13.5-18');
  assert.ok(!/Registration/.test(text));
});

test('an unlabelled banner name and its Ref. ID line never reach the output',()=>{
  const text='Sejal Hemal Mehta\n53 Year(s)/Female\nSejal Hemal Mehta Report Ref. ID : MUM6961961\nHemoglobin (Hb) 11.9 12 - 15 g/dL';
  const out=deidentify(text,{names:['Sejal Hemal Mehta']}).text;
  assert.ok(!/Sejal|Mehta|MUM6961961|Year/.test(out),out);
  assert.match(out,/Hemoglobin \(Hb\) 11\.9/);
  // and even without a detected name, the ID line and age banner are dropped
  assert.ok(!/Ref\. ID|Year\(s\)/.test(deidentify(text).text));
});

test('lab web addresses and corrupted repeated footer text are dropped',()=>{
  const junk='Orchard Healthcare Pvt. Ltd. www.orangehealth.in support@orangehealth.in 91 9008 11 11 44\nrangehealthorangehealthorangehealthorangehealth.......ininininininin supportsupportsupport@@@@';
  const out=deidentify(`${junk}\nHemoglobin 14.4 gm/dl 13.5-18`).text;
  assert.equal(out,'Hemoglobin 14.4 gm/dl 13.5-18');
});

test('identity-labelled lines are dropped even when OCR joins them to measurements',()=>{
  const out=deidentify('Patient Name: Jane Smith 13.2 g/dL\nHemoglobin Jane Smith 13.2 g/dL 12 - 16\nGlucose 101 mg/dL 70 - 99\nHemoglobin 13.2 g/dL 12 - 16').text;
  assert.ok(!out.includes('Jane Smith'),out);
  assert.match(out,/Glucose 101 mg\/dL/);
  assert.match(out,/Hemoglobin 13\.2 g\/dL/);
});
