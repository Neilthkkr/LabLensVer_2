import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const a=html.indexOf('function severityTier(m){'),b=html.indexOf('\n}\n',a)+3;
const context={};
vm.createContext(context);
vm.runInContext(`${html.slice(a,b)}\nthis.tier=severityTier;`,context);

const metrics=[
  {status:'normal',value:13,min:12,max:15},           // safe
  {status:'normal',value:12.1,min:12,max:15},         // near the edge
  {status:'low',value:11.9,min:12,max:15},            // slightly outside: still outside
  {status:'high',value:30,min:10,max:20},             // far outside
  {status:'classifier',value:17.7,min:null,max:null}, // screening index, not graded
  {status:'unknown',value:5,min:null,max:null},       // no range
  {status:'normal',value:'Negative',min:null,max:null} // qualitative normal
];

test('every extracted value lands in exactly one bucket, so the tiles add up to the total',()=>{
  const counts={};
  metrics.forEach(m=>{const t=context.tier(m);counts[t]=(counts[t]||0)+1});
  assert.equal(Object.values(counts).reduce((n,v)=>n+v,0),metrics.length);
});

test('outside-range count equals the number of high and low statuses',()=>{
  const outside=metrics.filter(m=>context.tier(m)==='tier-concern').length;
  assert.equal(outside,metrics.filter(m=>m.status==='high'||m.status==='low').length);
});

test('a value only slightly outside its range is outside, not borderline',()=>{
  assert.equal(context.tier({status:'low',value:11.9,min:12,max:15}),'tier-concern');
});

const n=html.indexOf('function prettyMetricName'),m=html.indexOf('function prettyUnit');
vm.runInContext(`${html.slice(n,m)}\nthis.pretty=prettyMetricName;`,context);
test('parser-style dashes around abbreviations read as parentheses',()=>{
  assert.equal(context.pretty('Hemoglobin -Hb'),'Hemoglobin (Hb)');
  assert.equal(context.pretty('Thyroid Stimulating Hormone -TSH-'),'Thyroid Stimulating Hormone (TSH)');
  assert.equal(context.pretty('Blood Urea Nitrogen -BUN-/Creatinine'),'Blood Urea Nitrogen (BUN)/Creatinine');
  assert.equal(context.pretty('Non-High Density Lipoprotein'),'Non-High Density Lipoprotein');
});

const ia=html.indexOf('function parseLooseDate'),ib=html.indexOf('function nameSimilarity');
const ic=html.indexOf('function extractPatientIdentity'),id=html.indexOf('function offerGuestProfile');
vm.runInContext(`${html.slice(ia,ic)}\n${html.slice(ic,html.indexOf('let __gpPending',ic)>0?html.indexOf('/* ============== GUEST -> PROFILE',ic):id)}\nthis.ident=extractPatientIdentity;`,context);
test('sex and age are read from layouts such as "Age / Gender : 16 Yrs / Male"',()=>{
  assert.equal(context.ident('Age / Gender : 16 Yrs / Male','').sex,'male');
  assert.equal(context.ident('Age / Gender : / Male\n16 Yrs','').age,16);
  assert.equal(context.ident('Sex: Female','').sex,'female');
  assert.equal(context.ident('Age/Sex: 34/Male','').sex,'male');
});

test('name, sex and age are read from real report banners',()=>{
  const a=context.ident('Sejal Hemal Mehta\n53 Year(s)/Female\nReported on','');
  assert.deepEqual([a.name,a.sex,a.age],['Sejal Hemal Mehta','female',53]);
  const b=context.ident('Patient Name : KRISH UPADHYAY Report Date 04-Aug-2026\nAge / Gender : / Male\n16 Yrs','');
  assert.deepEqual([b.name,b.sex,b.age],['KRISH UPADHYAY','male',16]);
});

test('an age quoted in prose (eGFR footnote) does not beat the banner age',()=>{
  const banner='Sejal Hemal Mehta\n53 Year(s)/Female\n';
  const foot='\n'+'x'.repeat(1200)+'\neGFR for : age > 14yrs - calculated by CKD-EPI\nage upto 14yrs - calculated by Pottel';
  assert.equal(context.ident(banner+foot,'').age,53);
});

const t1=html.indexOf('function locateValueBox'),t2=html.indexOf('function attachMetricBoxes');
vm.runInContext(`${html.slice(t1,t2)}\nthis.loc=locateValueBox;`,context);
test('the value box is the word that holds the value, not the whole row',()=>{
  const ln={text:'Hemoglobin (Hb) 11.9 12 - 15',x0n:0.1,x1n:0.9,y0n:0.2,y1n:0.22,words:[{s:'Hemoglobin (Hb)',a:0.1,b:0.3},{s:'11.9',a:0.5,b:0.56},{s:'12 - 15',a:0.7,b:0.9}]};
  const b=context.loc({value:11.9},ln);
  assert.deepEqual([b.x0,b.x1],[0.5,0.56]);
});
test('without word boxes the value box is estimated inside the row and stays within it',()=>{
  const ln={text:'Glucose 106 70 - 99',x0n:0.1,x1n:0.9,y0n:0.3,y1n:0.32};
  const b=context.loc({value:106},ln);
  assert.ok(b.x0>=0.1&&b.x1<=0.9&&b.x1>b.x0);
});

const r1=html.indexOf('function metricRangeBar'),r2=html.indexOf('function renderMetricSheet');
vm.runInContext(`const trendTierColor=t=>t;const fmtTick=v=>String(v);const esc=s=>String(s);const metricValueText=m=>String(m.value);\n${html.slice(r1,r2)}\nthis.bar=metricRangeBar;`,context);
const pos=h=>[...h.matchAll(/class="rb-dot" style="left:([\d.]+)%/g)].map(x=>+x[1])[0];
const band=h=>{const m=/class="rb-ref" style="left:([\d.]+)%;width:([\d.]+)%/.exec(h);return [+m[1],+m[1]+ +m[2]]};
test('range bar: an in-range value sits inside the green band at its true position',()=>{
  const h=context.bar({name:'x',value:13.5,min:12,max:15,status:'normal',unit:'',normal_range:'12 - 15'},'tier-safe');
  const [a,b]=band(h),p=pos(h);
  assert.ok(p>a&&p<b);
  assert.ok(Math.abs(p-(a+b)/2)<1,'13.5 is the midpoint of 12-15');
});
test('range bar: a value below the range is left of the band, above is right, neither pinned to an end',()=>{
  const low=context.bar({name:'x',value:11.9,min:12,max:15,status:'low',normal_range:'12 - 15'},'tier-concern');
  const high=context.bar({name:'x',value:30,min:10,max:20,status:'high',normal_range:'10 - 20'},'tier-concern');
  assert.ok(pos(low)<band(low)[0]);
  assert.ok(pos(high)>band(high)[1]);
  assert.ok(pos(low)>0&&pos(high)<100||pos(high)<=100);
});
test('range bar: the position moves with the value (not the same spot at each end)',()=>{
  const at=v=>pos(context.bar({name:'x',value:v,min:12,max:15,status:'normal',normal_range:'12 - 15'},'tier-safe'));
  assert.ok(at(12.2)<at(13.5)&&at(13.5)<at(14.8));
});
test('range bar: one-sided ranges still place the value on a scale',()=>{
  const h=context.bar({name:'LDL',value:132,min:null,max:100,status:'high',normal_range:'< 100'},'tier-concern');
  assert.ok(pos(h)>band(h)[1]);
});
