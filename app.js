
/* ============================================================================
   LabLens — Offline-First, Privacy-Focused Lab Report PWA
   Developed as a pristine, zero-server-leak health dashboard.
   All processing, text extraction, reference parsing, and database history
   live strictly inside the user's browser (Local Storage & PWA Caching).
   ============================================================================ */

import {profileOverview,latestReadings} from './src/core/family-summary.mjs';
import {STANDARD_RANGES,rangeForProfile,std_,matchTest,statusForQualified,normalizedUnit,comparableUnit,parseReportText} from './src/core/lab-parser.mjs';
import {buildChatContext,MAX_QUESTIONS as CHAT_MAX_QUESTIONS} from './src/core/chat-context.mjs';

(function(){
'use strict';
// Never let a link or bookmark erase local health records. Older builds accepted
// ?clear=1 and ?reset=1 as destructive commands; strip those parameters safely.
try{
  const startupUrl=new URL(location.href);
  const hadUnsafeReset=startupUrl.searchParams.has('clear')||startupUrl.searchParams.has('reset');
  if(hadUnsafeReset){
    startupUrl.searchParams.delete('clear');
    startupUrl.searchParams.delete('reset');
    history.replaceState(null,'',startupUrl.pathname+(startupUrl.search||'')+startupUrl.hash);
    console.warn('[LabLens] Ignored unsafe URL reset request. Local data was not changed.');
  }
}catch(e){}
function configurePdfEngine(){
  if(!window.pdfjsLib)return false;
  try{
    pdfjsLib.GlobalWorkerOptions.workerSrc=new URL('./vendor/pdfjs/pdf.worker.min.js',document.baseURI).href;
    return true;
  }catch(e){return false;}
}
configurePdfEngine();
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const metricValueText=m=>m&&m.valueText?String(m.valueText):`${m&&m.qualifier||''}${m&&m.value!=null?m.value:''}`;

const SAFE_METRIC_STATUSES=new Set(['normal','high','low','borderline','unknown','classifier']);
const SAFE_METRIC_KEY=/^[A-Za-z0-9 _.,:+/%#()\[\]-]{1,120}$/;
const safeText=(value,max=2000)=>['string','number','boolean'].includes(typeof value)?String(value).slice(0,max):'';
const safeCount=(value,fallback=0,max=1000000)=>{
  if(!['number','string'].includes(typeof value))return fallback;
  const n=Number(value);
  return Number.isSafeInteger(n)&&n>=0&&n<=max?n:fallback;
};
const safeLocalImage=value=>{
  const data=typeof value==='string'?value:'';
  return data.length<=20000000&&/^data:image\/(?:png|jpe?g|webp|bmp);base64,/i.test(data)?data:'';
};
function normalizeAnalysisRecord(record,index=0){
  if(!record||typeof record!=='object'||Array.isArray(record))return null;
  const numericId=['number','string'].includes(typeof record.id)?Number(record.id):NaN;
  const id=Number.isSafeInteger(numericId)&&numericId>0?numericId:index+1;
  const metrics=(Array.isArray(record.metrics)?record.metrics:[]).slice(0,500).filter(m=>m&&typeof m==='object'&&!Array.isArray(m)).map((m,i)=>{
    let key=safeText(m.key,120);
    if(!SAFE_METRIC_KEY.test(key))key=`backup-metric-${i+1}`;
    const status=SAFE_METRIC_STATUSES.has(m.status)?m.status:'unknown';
    const finiteOrNull=value=>value==null||value===''?null:(['number','string'].includes(typeof value)&&Number.isFinite(Number(value))?Number(value):null);
    const unitCoord=value=>{const n=Number(value);return Number.isFinite(n)?Math.max(0,Math.min(1,n)):0};
    const page=Number(m.bboxPage);
    return {...m,key,status,name:safeText(m.name,200),unit:safeText(m.unit,80),normal_range:safeText(m.normal_range,200),rangeNote:safeText(m.rangeNote,200),classifierLabel:safeText(m.classifierLabel,120),srcLine:safeText(m.srcLine,500),value:typeof m.value==='number'&&Number.isFinite(m.value)?m.value:safeText(m.value,100),valueText:safeText(m.valueText,120),qualifier:safeText(m.qualifier,20),min:finiteOrNull(m.min),max:finiteOrNull(m.max),needsReview:m.needsReview===true,reviewReasons:Array.isArray(m.reviewReasons)?m.reviewReasons.slice(0,20).map(x=>safeText(x,120)):[],bboxPage:Number.isSafeInteger(page)&&page>=0&&page<100?page:null,bbox:m.bbox&&typeof m.bbox==='object'?{x0:unitCoord(m.bbox.x0),y0:unitCoord(m.bbox.y0),x1:unitCoord(m.bbox.x1),y1:unitCoord(m.bbox.y1)}:null};
  });
  const patient=record.detectedPatient&&typeof record.detectedPatient==='object'?record.detectedPatient:{};
  const audit=record.audit&&typeof record.audit==='object'?record.audit:{};
  const age=['number','string'].includes(typeof patient.age)&&Number.isFinite(Number(patient.age))?Number(patient.age):null;
  const counts={
    totalMetrics:metrics.length,
    normalCount:safeCount(record.normalCount),
    highCount:safeCount(record.highCount),
    lowCount:safeCount(record.lowCount),
    outOfRangeCount:safeCount(record.outOfRangeCount),
    safeCount:safeCount(record.safeCount),
    borderlineCount:safeCount(record.borderlineCount),
    concernCount:safeCount(record.concernCount)
  };
  return {...record,id,metrics,...counts,
    fileName:safeText(record.fileName||'Health Report',255),
    category:['lab','other','prescription'].includes(record.category)?record.category:'other',
    date:safeText(record.date,40),analyzedAt:safeText(record.analyzedAt,40),
    rawText:safeText(record.rawText,200000),laymanSummary:safeText(record.laymanSummary,20000),
    detectedPatient:{name:safeText(patient.name,120),age:age!=null&&age>=0&&age<=130?age:null,sex:safeText(patient.sex,30)},
    audit:{uploadedCount:safeCount(audit.uploadedCount,1),duplicateCount:safeCount(audit.duplicateCount),unitStandardized:safeCount(audit.unitStandardized),duplicateExisting:audit.duplicateExisting===true},
    recommendations:record.category==='lab'
      ?recommendations(metrics.filter(m=>m.status==='high'),metrics.filter(m=>m.status==='low'))
      :(Array.isArray(record.recommendations)?record.recommendations.slice(0,30).filter(x=>x&&typeof x==='object').map(x=>({title:safeText(x.title,160),desc:safeText(x.desc,1000)})):[]),
    tags:Array.isArray(record.tags)?record.tags.slice(0,100).map(x=>safeText(x,60)):[],note:safeText(record.note,10000),
    scanImages:Array.isArray(record.scanImages)?record.scanImages.slice(0,30).filter(x=>x&&typeof x==='object').map(x=>({name:safeText(x.name||'medical image',255),dataURL:safeLocalImage(x.dataURL),tags:Array.isArray(x.tags)?x.tags.slice(0,30).map(t=>safeText(t,60)):[]})):[],
    docPages:Array.isArray(record.docPages)?record.docPages.slice(0,100).filter(x=>x&&typeof x==='object').map(x=>({image:safeLocalImage(x.image)})):[]
  };
}

const LS={get(k,fb){try{let v=localStorage.getItem(k);return v==null?fb:JSON.parse(v)}catch{return fb}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true}catch{return false}},del(k){try{localStorage.removeItem(k);return true}catch{return false}}};
const fmtDate=(iso,opts)=>{try{return new Date(iso).toLocaleDateString('en-US',opts||{year:'numeric',month:'long',day:'numeric'})}catch{return ''}};
let toastTimer=null;function showToast(msg,type='info'){const t=$('toast');t.className='toast '+type;t.textContent=msg;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),3200)}
const CATS=[
 {key:'lab',label:'Lab Panels',icon:'',kw:['lab','laboratory','haematology','hematology','biochemistry','cbc','complete blood count','serum','plasma','reference range','mg/dl','mmol/l','u/l','specimen','glucose','cholesterol','creatinine','urinalysis','lipid profile','liver function','thyroid','hba1c']},
 {key:'other',label:'Clinical Notes',icon:'',kw:[]}
];
const catMeta=k=>CATS.find(c=>c.key===k)||CATS[CATS.length-1];
function detectCategory(text,hasMetrics,metrics){
  const t=' '+String(text||'').toLowerCase().replace(/\s+/g,' ')+' ';
  const scores={};
  for(const c of CATS){
    if(c.key==='other')continue;
    let sc=0;
    for(const kw of c.kw){
      let n=0,idx=0;
      const re=new RegExp('\\b'+kw.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b','gi');
      while(re.exec(t)&&++n<8){}
      if(n)sc+=n*(kw.length>=10?4:kw.length>6?2:1);
    }
    scores[c.key]=sc;
  }

  // ---- OPTICAL / SPECTACLE PRESCRIPTION (highest priority — very specific signals) ----
  // The Lenskart-style invoice has: SPH / CYL / AXIS / PD / ADD headers with numeric
  // values (typically negative for myopia). This is unmistakable.
  const hasSphCyl=/\bsph\b[\s\S]{0,80}\bcyl\b/i.test(t) || /\bcyl\b[\s\S]{0,80}\baxis\b/i.test(t);
  const hasREle =/\b(re|od)\b[^a-z]{0,6}[-+]?\d/i.test(t) && /\b(le|os)\b[^a-z]{0,6}[-+]?\d/i.test(t);
  const diopValues=(t.match(/[-+]\d{1,2}\.\d{1,2}/g)||[]).length;   // "-5.50", "-3.75"
  if(hasSphCyl || hasREle || (diopValues>=3 && /spectacle|lens|frame|optical|prescription/.test(t))){
    scores.optical=(scores.optical||0)+30;
  }
  // A vision INVOICE (Lenskart, VisionExpress etc.) — not a clinical report
  if(/tax invoice|invoice[\s#:]|grand total|vat trn/i.test(t) && (scores.optical||0)>0){
    scores.optical+=10;
  }

  // ---- LAB — needs BOTH numeric values AND lab-report structure ----
  // "reference range", "biological reference", "specimen", "collection date" etc.
  const labStruct=/reference (range|interval)|biological reference|observed value|test\s+result|specimen|collection date/i.test(t);
  const n=Array.isArray(metrics)?metrics.length:(hasMetrics?1:0);
  if(labStruct && n>=1)scores.lab=(scores.lab||0)+15;
  else if(n>=3 && !hasSphCyl && !hasREle)scores.lab=(scores.lab||0)+8;   // require lab structure, not just numbers
  else if(n>=1 && !hasSphCyl && !hasREle)scores.lab=(scores.lab||0)+3;

  if(/\bfindings\b[\s\S]{0,400}\bimpression\b|radiologist|scan protocol|contrast administered|mri|\bct\b|x-ray|xray|ultrasound|sonograph/i.test(t))scores.imaging=(scores.imaging||0)+10;
  if(/ejection fraction|sinus rhythm|st segment|\bqrs\b|echocardiograph|holter/i.test(t))scores.cardiac=(scores.cardiac||0)+10;
  if(/histopatholog|cytolog|biopsy|microscopic examination of tissue|malignan|carcinoma|gross examination/i.test(t))scores.pathology=(scores.pathology||0)+10;
  if(/\brx\b\s|tablet|capsule|tab\.|cap\.|once daily|twice daily|dispense|refill|sig:/i.test(t))scores.prescription=(scores.prescription||0)+6;
  if(/vaccin|immunis|immuniz|booster dose|batch no|lot no/i.test(t))scores.vaccination=(scores.vaccination||0)+8;
  if(/discharge summary|date of admission|hospital course|advice on discharge/i.test(t))scores.discharge=(scores.discharge||0)+10;
  if(/\bdental\b|\bmolar\b|root canal|periodontal|caries/i.test(t))scores.dental=(scores.dental||0)+8;
  // Ophthalmology is a CLINICAL eye exam (visual acuity, IOP, fundus) — not a specs invoice.
  if(/visual acuity|intraocular pressure|\bfundus\b|refraction|slit lamp|ophthalmolog|retina/i.test(t) && !hasSphCyl && !hasREle)scores.ophthalmology=(scores.ophthalmology||0)+8;
  if(/phq-9|gad-7|psychiatr|depression scale|mental health/i.test(t))scores.mental=(scores.mental||0)+8;
  if(/karyotype|heterozygous|homozygous|sequencing|\ballele\b|\bbrca\b/i.test(t))scores.genetics=(scores.genetics||0)+8;

  let best='other',top=0;
  for(const k in scores)if(scores[k]>top){top=scores[k];best=k}
  return top>=6?best:(n?'lab':'other');
}


const MONTHS={jan:0,january:0,feb:1,february:1,mar:2,march:2,apr:3,april:3,may:4,jun:5,june:5,jul:6,july:6,aug:7,august:7,sep:8,sept:8,september:8,oct:9,october:9,nov:10,november:10,dec:11,december:11};
function validReportDate(d){
  if(!(d instanceof Date)||isNaN(d))return null;
  const now=new Date(), tomorrow=new Date(now.getFullYear(),now.getMonth(),now.getDate()+1);
  if(d.getFullYear()<1900||d>tomorrow)return null;
  return new Date(d.getFullYear(),d.getMonth(),d.getDate(),12,0,0).toISOString();
}
function twoDigitYear(y){y=+y;return y<50?2000+y:1900+y}
function parseDateCandidate(a,b,c,mode){
  let d,m,y;
  if(mode==='ymd'){y=+a;m=+b-1;d=+c}
  else {d=+a;m=+b-1;y=+c;if(y<100)y=twoDigitYear(y)}
  return validReportDate(new Date(y,m,d,12,0,0));
}
function extractReportDate(rawText,fileName){
  const text=((rawText||'')+'\n'+(fileName||'')).replace(/\s+/g,' ');
  const picks=[];
  const push=(iso,score,label)=>{if(iso)picks.push({iso,score,label})};
  const labelled=/(?:report|collection|collected|sample|specimen|test|result|date|performed|received|exam|study)\s*(?:date|on|dt)?\s*[:\-]?\s*/ig;
  let m;
  while((m=labelled.exec(text))){
    const chunk=text.slice(m.index,m.index+110);
    let x=/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/.exec(chunk); if(x)push(parseDateCandidate(x[1],x[2],x[3]),10,'labelled numeric');
    x=/(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/.exec(chunk); if(x)push(parseDateCandidate(x[1],x[2],x[3],'ymd'),10,'labelled ymd');
    x=/(\d{1,2})\s*[- ]\s*([A-Za-z]{3,9})\s*[-, ]\s*(\d{2,4})/.exec(chunk); if(x&&MONTHS[x[2].toLowerCase()]!=null)push(validReportDate(new Date((+x[3]<100?twoDigitYear(x[3]):+x[3]),MONTHS[x[2].toLowerCase()],+x[1],12)),11,'labelled month');
    x=/([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{2,4})/.exec(chunk); if(x&&MONTHS[x[1].toLowerCase()]!=null)push(validReportDate(new Date((+x[3]<100?twoDigitYear(x[3]):+x[3]),MONTHS[x[1].toLowerCase()],+x[2],12)),11,'labelled month');
  }
  for(const x of text.matchAll(/(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/g))push(parseDateCandidate(x[1],x[2],x[3],'ymd'),4,'numeric ymd');
  for(const x of text.matchAll(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/g))push(parseDateCandidate(x[1],x[2],x[3]),3,'numeric');
  for(const x of text.matchAll(/(\d{1,2})\s*[- ]\s*([A-Za-z]{3,9})\s*[-, ]\s*(\d{2,4})/g))if(MONTHS[x[2].toLowerCase()]!=null)push(validReportDate(new Date((+x[3]<100?twoDigitYear(x[3]):+x[3]),MONTHS[x[2].toLowerCase()],+x[1],12)),5,'month');
  picks.sort((a,b)=>b.score-a.score||new Date(b.iso)-new Date(a.iso));
  return picks[0]||null;
}
function textLooksMeaningful(text,metrics,cat,isImageOnly=false){
  const t=(text||'').trim();
  if(!t)return false;
  if(metrics&&metrics.length)return true;
  // The noise filter exists for ONE case: a plain photo/X-ray where OCR reads
  // burned-in labels and junk. It must NOT be applied to real documents — a short
  // prescription or vaccination card is perfectly valid and was being thrown away.
  if(!isImageOnly)return t.length>=12;
  const words=(t.match(/[A-Za-z]{3,}/g)||[]).length;
  const keywordMatches=(t.match(/report|finding|impression|diagnosis|history|doctor|patient|laborator|reference range|specimen|radiolog|clinical|prescription|tablet|\btab\b|\bcap\b|capsule|hospital|vaccine|immunis|immuniz|dose|mg\b|discharge|collection date|sample date/ig)||[]).length;
  return words>=12 && keywordMatches>=2;
}


// Each icon is chosen to literally match what the marker measures — verified against
// the actual Unicode emoji set (no confirmed liver emoji exists yet; it's still only a
// proposal to the Unicode Consortium, so we use a colour-coded fallback rather than a
// wrong organ). 'blood' previously showed 🧬 (genetics) and 'liver' showed 🫁 (lungs) —
// both fixed below.
// Real vector icons, not emoji — emoji render differently across Apple/Google/
// Windows fonts, ignore CSS color (so e.g. a red heart on a red 'high' badge could
// lose contrast), and Unicode has no liver icon at all. Each icon below is drawn to
// literally match its marker (blood = droplet, kidney = bean shape, liver = the
// organ's real two-lobe silhouette, thyroid = its actual butterfly shape, etc.) and
// uses currentColor so it inherits .metric-icon's white, staying legible on every
// status colour (sage/terracotta/slate-blue/gray).
const GROUP_ICON={blood:'<svg width="19" height="19" viewBox="0 0 24 24"><path d="M12 3 C12 3 5 11.5 5 16 a7 7 0 0 0 14 0 C19 11.5 12 3 12 3 Z" fill="currentColor"/></svg>',urine:'<svg width="19" height="19" viewBox="0 0 24 24"><path d="M12 3 C12 3 5 11.5 5 16 a7 7 0 0 0 14 0 C19 11.5 12 3 12 3 Z" fill="none" stroke="currentColor" stroke-width="2"/></svg>',sugar:'<svg width="19" height="19" viewBox="0 0 24 24"><path d="M12 2 L20 7 V17 L12 22 L4 17 V7 Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',chol:'<svg width="19" height="19" viewBox="0 0 24 24"><path d="M12 20 C4 14 2 9.5 4.5 6.7 C6.6 4.4 10 5 12 8 C14 5 17.4 4.4 19.5 6.7 C22 9.5 20 14 12 20 Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',cardiac:'<svg width="19" height="19" viewBox="0 0 24 24"><path d="M12 20 C4 14 2 9.5 4.5 6.7 C6.6 4.4 10 5 12 8 C14 5 17.4 4.4 19.5 6.7 C22 9.5 20 14 12 20 Z" fill="currentColor"/></svg>',kidney:'<svg width="19" height="19" viewBox="0 0 24 24"><path d="M14 3 C9 3 6 7 6 12 C6 17 9 21 14 21 C17 21 17.5 17.5 15.5 15.5 C13.5 13.5 13.5 10.5 15.5 8.5 C17.5 6.5 17 3 14 3 Z" fill="currentColor"/></svg>',liver:'<svg width="19" height="19" viewBox="0 0 24 24"><path d="M3 10 C3 7 6 5 10 5.5 C13 6 14 5 17 5.5 C20 6 21 9 20.5 12 C20 15.5 17 17.5 13 17 C9.5 16.6 8 18 5.5 16.5 C3 15 3 12.5 3 10 Z" fill="currentColor"/></svg>',thyroid:'<svg width="19" height="19" viewBox="0 0 24 24"><path d="M12 12 C10 8 5 8 4 11 C3 14 6 16.5 10 15 C11 14.6 12 13.5 12 12 C12 13.5 13 14.6 14 15 C18 16.5 21 14 20 11 C19 8 14 8 12 12 Z" fill="currentColor"/></svg>',electro:'<svg width="19" height="19" viewBox="0 0 24 24"><path d="M12 3 L19 8 V16 L12 21 L5 16 V8 Z M12 3 V21 M5 8 L19 16 M19 8 L5 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',vitamin:'<svg width="19" height="19" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5" fill="currentColor"/><path d="M12 2 V5 M12 19 V22 M2 12 H5 M19 12 H22 M4.9 4.9 L7 7 M17 17 L19.1 19.1 M4.9 19.1 L7 17 M17 7 L19.1 4.9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',iron:'<svg width="19" height="19" viewBox="0 0 24 24"><path d="M6 3 V13 a6 6 0 0 0 12 0 V3" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><rect x="4" y="2" width="4.5" height="4" rx="0.8" fill="currentColor"/><rect x="15.5" y="2" width="4.5" height="4" rx="0.8" fill="currentColor"/></svg>',inflam:'<svg width="19" height="19" viewBox="0 0 24 24"><path d="M12 2 C12 2 7 8 7 13 a5 5 0 0 0 10 0 C17 10.5 15.5 10 15.5 10 C15.8 12 14.3 12.7 13.5 12 C12.5 11.2 13 9 12 2 Z" fill="currentColor"/></svg>',coag:'<svg width="19" height="19" viewBox="0 0 24 24"><rect x="3" y="9.5" width="18" height="5" rx="1.6" fill="currentColor"/></svg>',hormone:'<svg width="19" height="19" viewBox="0 0 24 24"><path d="M9 3 H15 M10 3 V9 L5 18 a2.2 2.2 0 0 0 2 3 H17 a2.2 2.2 0 0 0 2 -3 L14 9 V3" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',protein:'<svg width="19" height="19" viewBox="0 0 24 24"><circle cx="5.5" cy="12" r="2.6" fill="currentColor"/><circle cx="12" cy="7" r="2.6" fill="currentColor"/><circle cx="12" cy="17" r="2.6" fill="currentColor"/><circle cx="18.5" cy="12" r="2.6" fill="currentColor"/><path d="M5.5 12 L12 7 M5.5 12 L12 17 M12 7 L18.5 12 M12 17 L18.5 12" stroke="currentColor" stroke-width="1.6"/></svg>',immuno:'<svg width="19" height="19" viewBox="0 0 24 24"><path d="M12 2 L20 5.5 V11 C20 16 16.5 19.5 12 21 C7.5 19.5 4 16 4 11 V5.5 Z" fill="currentColor"/></svg>',eye:'<svg width="19" height="19" viewBox="0 0 24 24"><path d="M2 12 C2 12 6 5 12 5 C18 5 22 12 22 12 C22 12 18 19 12 19 C6 19 2 12 2 12 Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="12" cy="12" r="3.2" fill="currentColor"/></svg>',mental:'<svg width="19" height="19" viewBox="0 0 24 24"><path d="M9 3 C6 3 4.5 5.5 5 8 C3 9 3 12 5 13 C4.5 15.5 6.5 18 9.5 17.5 C10 19 13.5 19 14.5 17.5 C17.5 18 19.5 15.5 19 13 C21 12 21 9 19 8 C19.5 5.5 18 3 15 3 C13.5 3 13 4 12 4.5 C11 4 10.5 3 9 3 Z" fill="currentColor"/></svg>',optical:'<svg width="19" height="19" viewBox="0 0 24 24"><circle cx="6.5" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17.5" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M10.5 12 H13.5 M2.5 11 L2.5 12 M21.5 11 L21.5 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',other:'<svg width="19" height="19" viewBox="0 0 24 24"><path d="M9 2 V9 L4.5 18 a2.4 2.4 0 0 0 2.1 3.5 H17.4 a2.4 2.4 0 0 0 2.1 -3.5 L15 9 V2" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M6.5 15 H17.5" stroke="currentColor" stroke-width="2"/><path d="M8 2 H16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'};
function recommendations(high,low){
  const flagged=[...high,...low];
  if(!flagged.length)return [
    {title:'Check the report',desc:'Compare the extracted values with the original report. A value within its printed range does not, by itself, rule out a health concern.'},
    {title:'Keep your usual follow-up',desc:'A clinician can interpret these results alongside your symptoms, history and reason for testing.'}
  ];
  const names=[...new Set(flagged.map(m=>m.name))].slice(0,4).join(', ');
  const rec=[
    {title:'Verify the flagged values',desc:`Check ${names}${flagged.length>4?' and the other flagged values':''} against the original report, including the units and printed reference ranges. OCR can misread any of these details.`},
    {title:'Discuss the result in context',desc:'A result outside a reference range is not a diagnosis. Ask a qualified clinician what it means for your symptoms, medicines, and the circumstances of the test before changing your care.'}
  ];
  if(flagged.some(m=>m.group==='cardiac'))rec.push({title:'Know when to seek urgent help',desc:'If you have chest pain, trouble breathing, fainting, or other severe symptoms, seek urgent medical care.'});
  return rec;
}
function layman(metrics,high,low){if(!metrics.length)return"I couldn't identify specific lab values. Try a clearer scan or a text-based PDF.";let out=[];if(high.length+low.length)out.push(`Out of <strong>${metrics.length}</strong> recognized results, <strong>${high.length+low.length}</strong> are outside range: ${esc([...high,...low].map(m=>m.name).join(', '))}.`);else out.push(`None of the <strong>${metrics.length}</strong> recognized results are outside the selected reference ranges.`);out.push('<br><br><strong>What this means:</strong> '+(high.length+low.length?'Review the out-of-range values against the original report and discuss them with a qualified healthcare provider.':'This is an extraction summary, not a diagnosis. Verify the values against the original report and continue routine follow-up.'));return out.join('')}
let currentUser=null,users=[],uploadedFiles=[],currentAnalysis=null,groupMode='separate',uploadCategory='auto',historyFilter={q:'',status:'all'},activeResultTab='summary',selectedTrendKey=null,defaultTrendKey=LS.get('defaultTrendKey_'+(currentUser||'guest'),null),metricsFilter=null;
const historyKey=()=>`health_reports_${currentUser||'guest'}`;
function getHistory(){const stored=LS.get(historyKey(),[]);return Array.isArray(stored)?stored.map(normalizeAnalysisRecord).filter(Boolean):[]}
function setHistory(arr,{silent=false}={}){
  const ok=LS.set(historyKey(),Array.isArray(arr)?arr.map(normalizeAnalysisRecord).filter(Boolean):[]);
  if(!ok&&!silent)showToast('Browser storage is full. Your changes were not saved. Download a backup or free space.','error');
  return ok;
}

function renderUserSelect(){const sel=$('userSelect');sel.innerHTML='<option value="">Guest</option>'+users.map(u=>`<option value="${esc(u.username)}">${esc(u.nickname||u.username)}</option>`).join('')+'<option value="__add">Add profile…</option>';if(currentUser)sel.value=currentUser;fitProfileSelect()}
// Size the profile menu to the name it shows (a select otherwise sizes to its longest option).
function fitProfileSelect(){
  const sel=$('userSelect');if(!sel)return;
  try{
    const cs=getComputedStyle(sel),c=fitProfileSelect.c||(fitProfileSelect.c=document.createElement('canvas').getContext('2d'));
    c.font=`${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const text=sel.selectedOptions[0]?sel.selectedOptions[0].textContent:'Guest';
    sel.style.width=Math.ceil(c.measureText(text).width+38)+'px';
  }catch(e){}
}
function onProfileSelect(sel){if(sel.value==='__add'){sel.value=currentUser||'';openAddUserModal();return}switchUser(sel.value)}
function switchUser(name){const next=name||null;if(!LS.set('currentUser',next)){showToast('Could not switch profiles because browser storage is full. Your current profile is unchanged.','error');return false}currentUser=next;renderUserSelect();fitProfileSelect();defaultTrendKey=LS.get('defaultTrendKey_'+(currentUser||'guest'),null);selectedTrendKey=defaultTrendKey;uploadCategory=LS.get('uploadCategory_'+(currentUser||'guest'),'auto');const catSel=$('uploadCatSelect');if(catSel)catSel.value=uploadCategory;uploadedFiles=[];currentAnalysis=null;activeNavKey='new';updateFilePreview();renderUserBadge();updateUserInfoDisplay();try{renderUpcoming()}catch(e){}try{renderRecents()}catch(e){}$('resultsSection').classList.remove('active');$('historySection').style.display='none';$('uploadSection').style.display='grid';renderNav();window.scrollTo({top:0,behavior:'smooth'});return true}
function currentProfile(){
  return (users||[]).find(u=>u.username===currentUser);
}
function currentDisplayName(){
  const p=currentProfile();
  if(p){
    return p.nickname || p.username.slice(0,10);
  }
  return currentUser ? currentUser.slice(0,10) : 'Guest';
}
function renderUserBadge(){$('currentUserName').textContent=currentDisplayName()}
function updateUserInfoDisplay(){const sec=$('userInfoSection');if(!currentUser){sec.style.display='none';return}sec.style.display='flex';const p=currentProfile(),name=(p&&p.username)||currentDisplayName();$('userNameDisplay').textContent=name;$('userAvatar').textContent=name[0].toUpperCase();$('userDataFiles').textContent=uploadedFiles.length+' file'+(uploadedFiles.length===1?'':'s');const n=getHistory().length;$('userDataReports').textContent=n+' report'+(n===1?'':'s')}
let editingUser=null;
const USER_KEY_PREFIXES=['health_reports_','health_meds_','health_medlog_','uploadCategory_','defaultTrendKey_','currentAnalysisId_'];
function setUserModalMode(edit,profile){
  // Creating needs sex and date of birth; editing an old incomplete profile must not be blocked by them.
  $('newUserSex').required=!edit||!!(profile&&profile.sex);
  $('newUserDob').required=!edit||!!(profile&&profile.dob);
  $('addUserTitle').textContent=edit?'Edit profile':'Add profile';
  $('addUserIntro').textContent=edit?'Changing sex or date of birth can change which reference ranges apply.':'Reports are kept separate per person, on this device only.';
  $('addUserSubmit').textContent=edit?'Save changes':'Create profile';
  $('deleteUserBtn').hidden=!edit;
}
function openAddUserModal(){editingUser=null;$('addUserForm').reset();$('newUserDob').max=new Date().toISOString().slice(0,10);setUserModalMode(false);$('addUserModal').classList.add('active');setTimeout(()=>$('newUserName').focus(),50)}
function openEditUserModal(username){
  const u=users.find(x=>x.username===username);if(!u)return;
  $('newUserDob').max=new Date().toISOString().slice(0,10);
  editingUser=u.username;
  $('newUserName').value=u.username;$('newUserNickname').value=u.nickname||'';$('newUserSex').value=u.sex||'';$('newUserDob').value=u.dob||'';
  setUserModalMode(true,u);
  $('addUserModal').classList.add('active');setTimeout(()=>$('newUserName').focus(),50);
}
function closeAddUserModal(){$('addUserModal').classList.remove('active');$('addUserForm').reset();editingUser=null;setUserModalMode(false)}
// Reference ranges depend on sex and age at the report date. When those change, re-derive the
// range-dependent fields of stored values that used a general (not report-printed) range.
function recomputeProfileReports(username){
  const u=users.find(x=>x.username===username);if(!u)return 0;
  const key='health_reports_'+username,list=LS.get(key,[]);if(!Array.isArray(list))return 0;
  let changed=0;
  list.forEach(r=>{
    if(!Array.isArray(r.metrics))return;
    const age=ageYears(u.dob,r.date);
    r.metrics.forEach(m=>{
      if(!m||m.flaggedWrong||m.refFromReport||!m.known||typeof m.value!=='number'||!STANDARD_RANGES)return;
      const base=matchStdByKey(m.key);if(!base||!comparableUnit(m.unit,base.unit))return;
      const ov=rangeForProfile(base.key,u.sex,age);
      const min=ov?ov.min:base.min,max=ov?ov.max:base.max;
      if(min===m.min&&max===m.max)return;
      m.min=min;m.max=max;m.status=statusForQualified(m.value,min,max,m.qualifier);
      m.normal_range=rangeText(min,max,m.unit||'');m.rangeNote=ov?ov.note:'general adult range';changed++;
    });
    const ms=r.metrics,hi=ms.filter(m=>m.status==='high'),lo=ms.filter(m=>m.status==='low');
    r.highCount=hi.length;r.lowCount=lo.length;r.outOfRangeCount=hi.length+lo.length;r.normalCount=ms.filter(m=>m.status==='normal').length;
    r.safeCount=ms.filter(m=>severityTier(m)==='tier-safe').length;r.borderlineCount=ms.filter(m=>severityTier(m)==='tier-borderline').length;r.concernCount=ms.filter(m=>severityTier(m)==='tier-concern').length;
    if(r.category==='lab'){r.laymanSummary=layman(ms,hi,lo);r.recommendations=recommendations(hi,lo)}
  });
  if(changed&&!LS.set(key,list))throw new Error('Browser storage is full. Saved report ranges were not updated.');
  return changed;
}
function matchStdByKey(k){try{return std_(k)}catch{return null}}
function moveUserData(from,to){
  const entries=USER_KEY_PREFIXES.map(pre=>({source:pre+from,target:pre+to,value:LS.get(pre+from,null)})).filter(x=>x.value!=null);
  if(entries.some(entry=>LS.get(entry.target,null)!=null))throw new Error('Saved records already exist under that profile name. Choose another name.');
  const written=[];
  for(const entry of entries){
    if(!LS.set(entry.target,entry.value)){
      written.forEach(x=>LS.del(x));
      throw new Error('Browser storage is full. Saved records remain under the old profile name.');
    }
    written.push(entry.target);
  }
  // The source stays in place until the profile list and current-user pointer
  // are durable. A failed metadata write can then discard these copies safely.
  return {commit:()=>entries.map(entry=>LS.del(entry.source)).every(Boolean),rollback:()=>written.map(key=>LS.del(key)).every(Boolean)};
}
async function deleteProfile(){
  const name=editingUser;if(!name)return;
  const n=(LS.get('health_reports_'+name,[])||[]).length;
  const ok=await confirmDialog(`Delete the profile "${name}"${n?` and its ${n} saved report${n===1?'':'s'}`:''}?\n\nThis cannot be undone.`);
  if(!ok)return;
  const nextUsers=users.filter(u=>u.username!==name);
  if(!LS.set('healthUsers',nextUsers))return showToast('Browser storage is full. The profile was not deleted.','error');
  users=nextUsers;
  const removed=USER_KEY_PREFIXES.map(pre=>LS.del(pre+name)).every(Boolean);
  closeAddUserModal();
  const wasCurrent=currentUser===name;
  renderUserSelect();
  if(wasCurrent){$('userSelect').value='';switchUser('')}
  try{renderProfilesList();renderRecents()}catch{}
  showToast(removed?`Deleted ${name}`:`Profile removed, but some local records could not be deleted. Use Delete all data to retry.`,removed?'info':'error');
}
function editProfileFromList(btn){openEditUserModal(btn.dataset.user)}
function editCurrentProfile(){if(currentUser)openEditUserModal(currentUser)}
function renderProfilesList(){
  const host=$('profileList');if(!host)return;
  host.innerHTML=users.length?users.map(u=>{const a=ageYears(u.dob);return `<li><span class="pl-main"><strong>${esc(u.username)}</strong><small>${esc([u.sex==='female'?'Female':u.sex==='male'?'Male':'',a!=null?a+' years':''].filter(Boolean).join(' · ')||'No details')}</small></span><button class="btn-secondary" type="button" data-user="${esc(u.username)}" onclick="editProfileFromList(this)">Edit</button><button class="btn-secondary" type="button" data-user="${esc(u.username)}" onclick="printDoctorSummary(this.dataset.user)">Doctor summary (PDF)</button></li>`}).join(''):'<li class="pl-empty">No profiles yet. Reports are saved under Guest.</li>';
}
// BUG FIX: uploading in Guest mode, then creating a named profile, used to
// silently orphan the guest data — it stayed under the 'guest' storage key
// forever while the new profile started empty, with no warning either way.
// Now: if guest-mode data exists when a profile is created, ask whether to
// move it into the new profile (the overwhelmingly common intent — someone
// tried the app as a guest, liked it, and is now formalising their profile).
function guestDataSummary(){
  const reports=LS.get('health_reports_guest',[]);
  const meds=LS.get('health_meds_guest',[]);
  const nR=Array.isArray(reports)?reports.length:0;
  const nM=Array.isArray(meds)?meds.length:0;
  return {nR,nM,has:(nR>0||nM>0)};
}
function migrateGuestDataTo(username){
  const prefixes=['health_reports_','health_meds_','health_medlog_','uploadCategory_','defaultTrendKey_'];
  const entries=prefixes.map(prefix=>({source:prefix+'guest',target:prefix+username,value:LS.get(prefix+'guest',null)})).filter(x=>x.value!=null);
  if(entries.some(entry=>LS.get(entry.target,null)!=null))throw new Error('The new profile already has saved records. Guest records remain in Guest.');
  const written=[];
  for(const entry of entries){
    if(!LS.set(entry.target,entry.value)){
      written.forEach(x=>LS.del(x));
      throw new Error('Browser storage is full. Saved records remain in Guest.');
    }
    written.push(entry.target);
  }
  const removed=entries.map(entry=>LS.del(entry.source)).every(Boolean);
  if(!removed)throw new Error('Guest records were copied, but some originals could not be removed. Check both profiles before continuing.');
}
async function addUser(e){
  e.preventDefault();
  const username=$('newUserName').value.trim();
  const nickname=($('newUserNickname').value||'').trim().slice(0,10);
  const sex=$('newUserSex').value;
  const dob=$('newUserDob').value;
  if(!username)return;
  if(!nickname)return showToast('Please enter a nickname','error');
  if(editingUser){
    const cur=users.find(u=>u.username===editingUser);
    if(!cur)return closeAddUserModal();
    // An incomplete profile (made before sex and date of birth were required) can still be renamed;
    // one that has them cannot have them cleared, since ranges depend on them.
    if((cur.sex&&!sex)||(cur.dob&&!dob))return showToast('Sex and date of birth are needed to use the right reference ranges','error');
    const incomplete=!sex||!dob;
    if(users.some(u=>u!==cur&&u.username.toLowerCase()===username.toLowerCase()))return showToast('Another profile already has that name','error');
    const old=cur.username,detailsChanged=(cur.sex||'')!==sex||(cur.dob||'')!==dob;
    const nextUsers=users.map(u=>u===cur?{...u,username,nickname,sex,dob}:u);
    let move=null,oldCopiesRemoved=true;
    try{
      if(old!==username)move=moveUserData(old,username);
      if(!LS.set('healthUsers',nextUsers))throw new Error('Browser storage is full. The profile was not updated.');
      if(currentUser===old&&old!==username&&!LS.set('currentUser',username)){
        LS.set('healthUsers',users);
        throw new Error('Browser storage is full. The profile was not renamed.');
      }
      if(move)oldCopiesRemoved=move.commit();
    }catch(error){if(move)move.rollback();return showToast(error.message,'error')}
    users=nextUsers;
    if(currentUser===old)currentUser=username;
    let recalculated=0;
    let recalcError=null;
    if(detailsChanged&&(LS.get('health_reports_'+username,[])||[]).length&&await confirmDialog('Recalculate this profile’s saved reports with the new sex and date of birth?\n\nValues that used general reference ranges will be re-checked. Ranges printed on a report are never changed.')){
      try{recalculated=recomputeProfileReports(username)}catch(error){recalcError=error.message}
    }
    closeAddUserModal();renderUserSelect();
    if(currentUser===username){$('userSelect').value=username;switchUser(username)}
    try{renderProfilesList();renderRecents()}catch{}
    return showToast(recalcError||(!oldCopiesRemoved?'Profile updated. Some old-name record copies remain on this device.':recalculated?`Profile updated. ${recalculated} value${recalculated===1?'':'s'} re-checked.`:incomplete?'Profile updated. Add sex and date of birth to get the right reference ranges.':'Profile updated'),recalcError||!oldCopiesRemoved?'error':(incomplete?'info':'success'));
  }
  const dupe=users.find(u=>u.username.toLowerCase()===username.toLowerCase());
  if(dupe){closeAddUserModal();$('userSelect').value=dupe.username;switchUser(dupe.username);return showToast(`${dupe.username} already exists. Switched to that profile.`,'info')}
  if(!sex||!dob)return showToast('Sex and date of birth are needed to use the right reference ranges','error');
  const wasGuestBeforeAdd = !currentUser;
  const nextUsers=[...users,{username,nickname,sex,dob,createdAt:new Date().toISOString()}];
  if(!LS.set('healthUsers',nextUsers))return showToast('Browser storage is full. The profile was not created.','error');
  users=nextUsers;
  renderUserSelect();closeAddUserModal();
  if(!switchUser(username))return;

  const guestData=guestDataSummary();
  if(guestData.has && wasGuestBeforeAdd){
    const bits=[];
    if(guestData.nR)bits.push(`${guestData.nR} report${guestData.nR===1?'':'s'}`);
    if(guestData.nM)bits.push(`${guestData.nM} medicine${guestData.nM===1?'':'s'}`);
    if(await confirmDialog(`You have ${bits.join(' and ')} saved under Guest. Move them into the new profile "${username}"?\n\nChoose Cancel to leave them under Guest instead.`)){
      try{migrateGuestDataTo(username)}catch(error){return showToast(error.message,'error')}
      showToast(`Moved your Guest data into ${username}`,'success');
      if(typeof renderHistoryList==='function')renderHistoryList();
    }
  }
  showToast('Profile created','success');

}
// The active profile drives which reference ranges we use.
function currentProfile(){return users.find(u=>u.username===currentUser)||null}
function ageYears(dob,asOf){
  if(!dob)return null;
  const b=new Date(dob), d=asOf?new Date(asOf):new Date();
  if(isNaN(b)||isNaN(d))return null;
  let a=d.getFullYear()-b.getFullYear();
  const m=d.getMonth()-b.getMonth();
  if(m<0||(m===0&&d.getDate()<b.getDate()))a--;
  return a>=0&&a<130?a:null;
}
// Age at the time the REPORT was taken, not today — a report from 5 years ago
// must be judged against the ranges for the age the person was then.
function profileContext(reportDate){
  const p=currentProfile();
  if(!p)return {sex:null,age:null};
  return {sex:p.sex||null, age:ageYears(p.dob, reportDate)};
}
function logoutUser(){switchUser('');$('userSelect').value='';showToast('Logged out','info')}
function toggleTheme(){const next=document.documentElement.getAttribute('data-theme')==='dark'?'light':'dark';document.documentElement.setAttribute('data-theme',next);LS.set('healthTheme',next);updateThemeIcon()}function updateThemeIcon(){}
const SUPPORTED_IMAGE_TYPES=new Set(['image/png','image/jpeg','image/webp','image/bmp','image/heic','image/heif']);
function isSupportedReportFile(file){
  const type=String(file.type||'').toLowerCase().split(';')[0];
  const extension=/\.(pdf|png|jpe?g|webp|bmp|heic|heif)$/i.test(file.name||'');
  if(type==='application/pdf')return true;
  if(SUPPORTED_IMAGE_TYPES.has(type))return true;
  return (!type||type==='application/octet-stream'||type==='application/x-pdf')&&extension;
}
function classifyType(file){return file.type==='application/pdf'||/\.pdf$/i.test(file.name)?'pdf':'image'}
function gradeImageQualityStats({width,height,mean,contrast,sharpness}){
  const issues=[],blocking=[],shortEdge=Math.min(width,height),ratio=width/Math.max(1,height);
  if(shortEdge<700)blocking.push('image resolution is too low');else if(shortEdge<1000)issues.push('resolution is lower than ideal');
  if(mean<38)blocking.push('photo is too dark');else if(mean<58)issues.push('photo may be too dark');
  if(mean>242)blocking.push('photo is overexposed');else if(mean>228)issues.push('photo may be overexposed');
  if(contrast<16)blocking.push('text contrast is too low');else if(contrast<27)issues.push('text contrast is low');
  if(sharpness<8)issues.push('photo may be blurred');
  if(ratio<.48||ratio>2.05)issues.push('report may be cropped');
  const all=[...blocking,...issues];
  return {level:blocking.length?'poor':(issues.length?'warn':'good'),blocking:blocking.length>0,issues:all,width,height,overridden:false,
    summary:all.length?all.join('; '):'clear enough for on-device OCR'};
}
async function assessImageQuality(file){
  const url=URL.createObjectURL(file);
  try{
    const img=await new Promise((resolve,reject)=>{const el=new Image();el.onload=()=>resolve(el);el.onerror=reject;el.src=url});
    const width=img.naturalWidth||img.width,height=img.naturalHeight||img.height;
    const scale=Math.min(1,480/Math.max(width,height));
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));
    const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0,canvas.width,canvas.height);
    const data=ctx.getImageData(0,0,canvas.width,canvas.height).data,gray=new Float32Array(canvas.width*canvas.height);
    let sum=0,sumSq=0;
    for(let p=0,j=0;p<data.length;p+=4,j++){const g=.299*data[p]+.587*data[p+1]+.114*data[p+2];gray[j]=g;sum+=g;sumSq+=g*g}
    const count=gray.length,mean=sum/count,contrast=Math.sqrt(Math.max(0,sumSq/count-mean*mean));
    let edge=0,edgeN=0;
    for(let y=1;y<canvas.height-1;y+=2)for(let x=1;x<canvas.width-1;x+=2){const i=y*canvas.width+x;const lap=Math.abs(4*gray[i]-gray[i-1]-gray[i+1]-gray[i-canvas.width]-gray[i+canvas.width]);edge+=lap;edgeN++}
    return gradeImageQualityStats({width,height,mean,contrast,sharpness:edge/Math.max(1,edgeN)});
  }catch(e){return{level:'warn',blocking:false,issues:['quality check unavailable'],width:0,height:0,overridden:false,summary:'quality check unavailable—verify OCR carefully'}}
  finally{URL.revokeObjectURL(url)}
}
// Phone photos are 12MP+ and can be rotated by EXIF. Draw them once into a bounded, upright JPEG so
// OCR, storage and the source crops all work from a predictable image (and iOS never runs out of memory).
async function normalizeImageFile(file){
  try{
    const MAX=2400;
    let src,w,h,bmp=null;
    if(window.createImageBitmap){try{bmp=await createImageBitmap(file,{imageOrientation:'from-image'})}catch{}}
    if(bmp){src=bmp;w=bmp.width;h=bmp.height}
    else{
      const url=URL.createObjectURL(file);
      src=await new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=url});
      w=src.naturalWidth;h=src.naturalHeight;setTimeout(()=>URL.revokeObjectURL(url),10000);
    }
    const scale=Math.min(1,MAX/Math.max(w,h));
    if(scale===1&&/jpeg|jpg/.test(file.type)&&file.size<3*1024*1024){if(bmp&&bmp.close)bmp.close();return file}
    const cw=Math.round(w*scale),ch=Math.round(h*scale),c=document.createElement('canvas');
    c.width=cw;c.height=ch;const g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,cw,ch);g.drawImage(src,0,0,cw,ch);
    if(bmp&&bmp.close)bmp.close();
    const blob=await new Promise(r=>c.toBlob(r,'image/jpeg',0.9));
    c.width=c.height=0;
    return blob?new File([blob],(file.name||'photo').replace(/\.[^.]+$/,'')+'.jpg',{type:'image/jpeg'}):file;
  }catch(e){console.warn('image normalisation skipped',e);return file}
}
async function handleFiles(list){const arr=Array.from(list||[]);let added=0;for(const file of arr){if(!isSupportedReportFile(file)){showToast(`${file.name||'File'} is not a supported PDF or image`,'error');continue}if(file.size>50*1024*1024){showToast(`${file.name} is too large (50 MB maximum)`,'error');continue}if(uploadedFiles.length>=10){showToast('You can analyze up to 10 files at a time','error');break}const totalSize=uploadedFiles.reduce((sum,item)=>sum+item.size,0);if(totalSize+file.size>100*1024*1024){showToast('The selected files exceed the 100 MB total limit','error');break}const isImg=classifyType(file)==='image';const entry={file,type:isImg?'image':'pdf',name:file.name,size:file.size};if(isImg){entry.quality={level:'checking',blocking:true,issues:[],summary:'preparing photo…'};uploadedFiles.push(entry);updateFilePreview();const nf=await Promise.race([normalizeImageFile(file),new Promise(r=>setTimeout(()=>r(file),8000))]);entry.file=nf;entry.name=nf.name;entry.size=nf.size}if(entry.type==='image'){entry.quality={level:'checking',blocking:true,issues:[],summary:'checking photo quality…'};updateFilePreview();entry.quality=await assessImageQuality(entry.file)}else uploadedFiles.push(entry);added++;updateFilePreview()}if(added){const blocked=blockingImageFiles().length;showToast(blocked?`${blocked} photo${blocked===1?'':'s'} need attention before analysis`:`${added} file${added===1?'':'s'} ready` ,blocked?'error':'success')}else if(!uploadedFiles.length)showToast('No supported files were added','error')}
function blockingImageFiles(){return uploadedFiles.filter(f=>f.type==='image'&&f.quality&&f.quality.blocking&&!f.quality.overridden)}
function overrideImageQuality(i){const f=uploadedFiles[i];if(!f||!f.quality)return;f.quality.overridden=true;updateFilePreview();showToast('Photo will be analyzed—verify every extracted value','info')}
function updateFilePreview(){const has=uploadedFiles.length>0,blocked=blockingImageFiles();{const dz=$('dropZone');if(dz)dz.classList.toggle('has-files',has)}$('previewArea').style.display=has?'block':'none';$('analyzeSection').style.display=has?'block':'none';$('fileListCount').textContent=`${uploadedFiles.length} file${uploadedFiles.length===1?'':'s'} selected${blocked.length?` · ${blocked.length} needs a retake`:''}`;$('fileList').innerHTML=uploadedFiles.map((f,i)=>{const q=f.quality;const qHtml=q?`<div class="quality-line"><span class="quality-badge ${q.level==='checking'?'warn':q.level}">${q.level==='good'?'Ready':q.level==='poor'?'Retake recommended':q.level==='checking'?'Checking…':'Check photo'}</span>${q.overridden?'<span class="quality-badge warn">Using anyway</span>':''}</div><div class="quality-detail">${esc(q.summary||'')}</div>${q.blocking&&!q.overridden?`<button class="quality-override" type="button" onclick="event.stopPropagation();overrideImageQuality(${i})">Use anyway</button>`:''}`:'';return`<div class="file-item ${q&&q.level==='poor'&&!q.overridden?'quality-poor':''}"><div class="file-item-icon ${f.type==='pdf'?'pdf':'image'}">${f.type==='pdf'?'PDF':'IMG'}</div><div class="file-item-info"><div class="file-item-name">${esc(f.name)}</div><div class="file-item-meta">${(f.size/1024).toFixed(1)} KB${q&&q.width?` · ${q.width}×${q.height}px`:''}</div>${qHtml}</div><button aria-label="Remove ${esc(f.name)}" class="remove-file-btn" onclick="removeFile(${i})" type="button"><svg class="icn" aria-hidden="true" focusable="false"><use href="#i-x"/></svg></button></div>`}).join('');$('groupToggle').classList.toggle('show',uploadedFiles.length>1);const btn=$('analyzeBtn');btn.disabled=blocked.length>0;btn.title=blocked.length?'Retake the photo or choose Use anyway first':'';btn.textContent=blocked.length?`Fix ${blocked.length} photo${blocked.length===1?'':'s'} before analysis`:(uploadedFiles.length>1?(groupMode==='separate'?`Analyze ${uploadedFiles.length} files → ${uploadedFiles.length} reports`:`Analyze ${uploadedFiles.length} files → 1 report`):'Analyze report');updateUserInfoDisplay()}
function removeFile(i){uploadedFiles.splice(i,1);updateFilePreview()}function clearAllFiles(){uploadedFiles=[];updateFilePreview()}function setGroupMode(m){groupMode=m;$('gtCombine').classList.toggle('active',m==='combine');$('gtSeparate').classList.toggle('active',m==='separate');updateFilePreview()}function setUploadCategory(k){uploadCategory=k||'auto';LS.set('uploadCategory_'+(currentUser||'guest'),uploadCategory);const hint=$('typePickerHint');if(hint)hint.textContent=uploadCategory==='auto'?"Detected from the content unless you choose.":`Forcing: ${catMeta(uploadCategory).label}`}
// One-handed use: on phones the add-report button sits at the bottom of the screen, just above the
// tab bar. How tall the block above it is depends on the profile name, so measure it instead of guessing.
function fitUploadMain(){
  const main=document.querySelector('.upload-main'),nav=$('headerNav');
  if(!main||!nav||!main.offsetParent)return;
  const top=main.getBoundingClientRect().top+window.scrollY;
  const room=window.innerHeight-top-nav.getBoundingClientRect().height-12;
  document.documentElement.style.setProperty('--upload-main-min',Math.max(0,Math.round(room))+'px');
}
function wireUploadFit(){
  if(typeof ResizeObserver==='function'){let queued=false;new ResizeObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;fitUploadMain()})}).observe(document.body)}
  window.addEventListener('resize',fitUploadMain);fitUploadMain();
}
function wireUpload(){
  const dz=$('dropZone'),add=$('addReportBtn');
  // One plain file input: phones show their own sheet (Take Photo, Photo Library, Choose Files); desktop opens the file browser.
  const inputs={files:$('fileInput')};
  add.onclick=()=>inputs.files.click();
  const pick=async(input,e)=>{
    // Copy the selection first: clearing the input empties the live FileList.
    const chosen=Array.from(e.target.files||[]);
    input.value='';
    try{await handleFiles(chosen)}catch(err){console.error('adding files failed',err);showToast('Couldn’t add that file. Try a different one.','error')}
  };
  [...Object.values(inputs)].forEach(input=>{if(input)input.onchange=e=>pick(input,e)});
  ['dragenter','dragover'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.add('drag-over')}));
  ['dragleave','drop'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.remove('drag-over')}));
  dz.addEventListener('drop',e=>handleFiles(e.dataTransfer.files));
}
async function fileToDataURL(file){return new Promise((res,rej)=>{const fr=new FileReader();fr.onload=()=>res(fr.result);fr.onerror=()=>rej(fr.error);fr.readAsDataURL(file)})}
function setProgress(p,text,sub){$('progressBarFill').style.width=Math.round(p*100)+'%';$('progressBarPct').textContent=Math.round(p*100)+'%';if(text)$('progressText').textContent=text;if(sub)$('progressSub').textContent=sub}
let ocrWorker=null,ocrWorkerPromise=null,ocrProgressCb=null;
// Privacy-safe OCR diagnostics. This never records report text, file names,
// images, profile data, or extracted values, and it is never transmitted.
window.__ocrRunLog=[];
function recordOcrRun(entry){
  try{
    const safe={
      at:new Date().toISOString(),
      engine:String(entry.engine||''),
      outcome:String(entry.outcome||''),
      sourceType:String(entry.sourceType||''),
      sourceBytes:Number.isFinite(entry.sourceBytes)?entry.sourceBytes:null,
      durationMs:Number.isFinite(entry.durationMs)?Math.round(entry.durationMs):null,
      preprocessingMs:Number.isFinite(entry.preprocessingMs)?Math.round(entry.preprocessingMs):null,
      confidence:Number.isFinite(entry.confidence)?Math.max(0,Math.min(1,entry.confidence)):null,
      wordCount:Number.isInteger(entry.wordCount)?entry.wordCount:null,
      heapDeltaBytes:Number.isFinite(entry.heapDeltaBytes)?entry.heapDeltaBytes:null,
      logicalProcessors:Number(navigator.hardwareConcurrency)||null,
      deviceMemoryGiB:Number(navigator.deviceMemory)||null,
      webgpu:!!navigator.gpu
    };
    window.__ocrRunLog.push(safe);
    if(window.__ocrRunLog.length>50)window.__ocrRunLog.splice(0,window.__ocrRunLog.length-50);
  }catch(e){}
}
function getOcrDiagnostics(){return JSON.parse(JSON.stringify(window.__ocrRunLog||[]))}


// External OCR backend removed - the app uses its built-in OCR only.
async function aiOcrImage(){return ''}
function preprocessImageForOCR(fileOrUrl,maxDim=1800){
  return new Promise(resolve=>{
    try{
      const img=new Image(); img.onload=()=>{
        const scale=Math.min(2,Math.max(1,maxDim/Math.max(img.width,img.height)));
        const w=Math.round(img.width*scale),h=Math.round(img.height*scale);
        const c=document.createElement('canvas');c.width=w;c.height=h;
        const cx=c.getContext('2d');cx.fillStyle='#fff';cx.fillRect(0,0,w,h);
        cx.drawImage(img,0,0,w,h);
        const d=cx.getImageData(0,0,w,h);
        const pixels=d.data;
        const n=w*h;

        // 1. Grayscale and store in a single channel
        const gray=new Uint8Array(n);
        for(let i=0;i<n;i++){
          const idx=i*4;
          gray[i]=Math.round(0.299*pixels[idx]+0.587*pixels[idx+1]+0.114*pixels[idx+2]);
        }

        // 2. Bradley-Roth Adaptive Thresholding using Integral Image
        const intImg=new Uint32Array(n);
        for(let x=0;x<w;x++){
          let sum=0;
          for(let y=0;y<h;y++){
            const idx=y*w+x;
            sum+=gray[idx];
            if(x===0) intImg[idx]=sum;
            else intImg[idx]=intImg[idx-1]+sum;
          }
        }

        // Apply thresholding based on local window means (handles shadows & uneven lighting)
        const s=Math.round(w/16); // window size (e.g. 1/16 of width)
        const t=15; // threshold percentage (15% below average)
        for(let i=0;i<n;i++){
          const x=i%w, y=Math.floor(i/w);
          const x1=Math.max(0,x-s), x2=Math.min(w-1,x+s);
          const y1=Math.max(0,y-s), y2=Math.min(h-1,y+s);
          const count=(x2-x1+1)*(y2-y1+1);

          const idx_br=y2*w+x2;
          const idx_tl=y1*w+x1;
          const idx_tr=y1*w+x2;
          const idx_bl=y2*w+x1;

          let sum=intImg[idx_br];
          if(x1>0 && y1>0) sum+=intImg[(y1-1)*w+(x1-1)];
          if(x1>0) sum-=intImg[y2*w+(x1-1)];
          if(y1>0) sum-=intImg[(y1-1)*w+x2];

          const avg=sum/count;
          const val=gray[i]<(avg*(100-t)/100)?0:255;
          const idx=i*4;
          pixels[idx]=pixels[idx+1]=pixels[idx+2]=val;
        }
        cx.putImageData(d,0,0);
        resolve(c.toDataURL('image/png'));
      };
      img.onerror=()=>resolve(fileOrUrl);
      if(typeof fileOrUrl==='string')img.src=fileOrUrl;
      else img.src=URL.createObjectURL(fileOrUrl);
    }catch(e){resolve(fileOrUrl)}
  })
}
/* ---------------- OCR: locally vendored Tesseract ----------------
   OCR executes entirely in this origin. Do not reintroduce runtime imports from
   package CDNs: imported code can read the same local health data as this app. */
window.__ocrEngineUsed='';

// Rebuild reading order from OCR boxes: group by baseline (y), sort left-to-right (x).
// Without this, PP-OCR returns detected regions in confidence/detection order, which
// scrambles a lab table exactly like raw pdf.js item order did.

// ppu-paddle-ocr's recognize() rejects data: URL strings (it only accepts an HTTP
// URL, absolute path, ArrayBuffer, or Canvas) — decode back to a canvas for it.
function ocrLinesFromData(data,width,height){
  return (Array.isArray(data&&data.lines)?data.lines:[]).map(line=>{
    const box=line&&line.bbox||{},words=Array.isArray(line&&line.words)?line.words:[];
    const confidence=Number(line&&line.confidence);
    const validBox=width>0&&height>0&&[box.x0,box.y0,box.x1,box.y1].every(Number.isFinite);
    return {text:String(line&&line.text||'').trim(),confidence:Number.isFinite(confidence)?Math.max(0,Math.min(1,confidence/100)):null,
      x0n:validBox?Math.max(0,box.x0/width):null,y0n:validBox?Math.max(0,box.y0/height):null,
      x1n:validBox?Math.min(1,box.x1/width):null,y1n:validBox?Math.min(1,box.y1/height):null,
      words:validBox?words.filter(w=>w&&w.bbox&&Number.isFinite(w.bbox.x0)&&Number.isFinite(w.bbox.x1)).map(w=>({s:String(w.text||''),a:Math.max(0,w.bbox.x0/width),b:Math.min(1,w.bbox.x1/width),confidence:Number.isFinite(w.confidence)?Math.max(0,Math.min(1,w.confidence/100)):null})):[]};
  }).filter(line=>line.text);
}
async function ocrImage(fileOrUrl,onProgress,evidence){
  const runStarted=performance.now();
  const heapBefore=performance.memory&&Number(performance.memory.usedJSHeapSize);
  const sourceType=(fileOrUrl&&fileOrUrl.type)||(/^data:image\//.test(String(fileOrUrl||''))?'image-data-url':typeof fileOrUrl);
  const sourceBytes=fileOrUrl&&Number.isFinite(fileOrUrl.size)?fileOrUrl.size:null;
  const preprocessStarted=performance.now();
  const input=await preprocessImageForOCR(fileOrUrl);
  const preprocessingMs=performance.now()-preprocessStarted;
  if(!window.Tesseract)throw new Error('OCR library not loaded');
  try{
    console.log('[PWA] Running locally vendored Tesseract OCR engine...');
    const {data}=await Tesseract.recognize(input, 'eng', {
      workerPath: new URL('./vendor/tesseract/worker.min.js',document.baseURI).href,
      corePath: new URL('./vendor/tesseract/tesseract-core.wasm.js',document.baseURI).href,
      langPath: new URL('./vendor/tessdata',document.baseURI).href,
      logger: m=>{if(onProgress && m && m.status==='recognizing text')onProgress(m.progress||0)}
    });
    window.__ocrEngineUsed='Tesseract';
    if(evidence){evidence.lines=ocrLinesFromData(data,evidence.width,evidence.height);evidence.confidence=Number.isFinite(data&&data.confidence)?Math.max(0,Math.min(1,data.confidence/100)):null}
    const heapAfter=performance.memory&&Number(performance.memory.usedJSHeapSize);
    recordOcrRun({
      engine:'Tesseract 5.1.0',outcome:'success',sourceType,sourceBytes,
      durationMs:performance.now()-runStarted,preprocessingMs,
      confidence:Number(data&&data.confidence)/100,
      wordCount:Array.isArray(data&&data.words)?data.words.length:null,
      heapDeltaBytes:Number.isFinite(heapBefore)&&Number.isFinite(heapAfter)?heapAfter-heapBefore:null
    });
    return data&&data.text?data.text:'';
  }catch(err){
    const heapAfter=performance.memory&&Number(performance.memory.usedJSHeapSize);
    recordOcrRun({
      engine:'Tesseract 5.1.0',outcome:'error',sourceType,sourceBytes,
      durationMs:performance.now()-runStarted,preprocessingMs,
      heapDeltaBytes:Number.isFinite(heapBefore)&&Number.isFinite(heapAfter)?heapAfter-heapBefore:null
    });
    console.error('[PWA] Tesseract global OCR failed:', err);
    throw err;
  }
}
async function renderPdfPageToImage(page,scale=2,quality=0.92){
  const viewport=page.getViewport({scale});const canvas=document.createElement('canvas');canvas.width=Math.floor(viewport.width);canvas.height=Math.floor(viewport.height);const ctx=canvas.getContext('2d');await page.render({canvasContext:ctx,viewport}).promise;return canvas.toDataURL('image/jpeg',quality);
}
// pdf.js returns text items in content-stream order, which for multi-column lab
// reports interleaves values/units/names. Rebuild proper visual rows by grouping
// items on the same baseline (y) and ordering left-to-right (x) — mirroring how a
// person reads the page, and how `pdftotext -layout` behaves.
function reconstructPdfLines(items){
  const its=(items||[]).filter(it=>it && typeof it.str==='string' && it.str.length)
    .map(it=>{const t=it.transform||[1,0,0,1,0,0];return {s:it.str,x:t[4],y:t[5],w:it.width||0};});
  if(!its.length)return '';
  // Cluster by y with a tolerance (font baselines wobble a little).
  its.sort((a,b)=>b.y-a.y || a.x-b.x);
  const rows=[]; let cur=null; const yTol=3;
  for(const it of its){
    if(cur && Math.abs(it.y-cur.y)<=yTol){ cur.items.push(it); cur.y=(cur.y*cur.items.length+it.y)/(cur.items.length+1); }
    else { cur={y:it.y,items:[it]}; rows.push(cur); }
  }
  const lines=rows.map(r=>{
    r.items.sort((a,b)=>a.x-b.x);
    let out='',prevEnd=null;
    for(const it of r.items){
      if(prevEnd!=null){
        const gap=it.x-prevEnd;
        const approxChar=(it.w/Math.max(1,it.s.length))||3;
        // insert a space (or several) proportional to the horizontal gap, so
        // column separations survive as whitespace the parser can key on.
        if(gap>approxChar*0.4)out+=(gap>approxChar*3?'   ':' ');
      }
      out+=it.s; prevEnd=it.x+(it.w||0);
    }
    return out.replace(/\s+/g,' ').trim();
  }).filter(Boolean);
  return lines.join('\n');
}
// §6: same row-reconstruction as reconstructPdfLines above, but returns each line's
// bounding box (normalized 0..1 against the page's own point-space) alongside its
// text, instead of collapsing straight to a joined string. Kept as a SEPARATE
// function rather than modifying reconstructPdfLines itself, so the deterministic
// text the parser sees (§1) is never at risk of changing shape.
function reconstructPdfLinesBoxed(items,pageW,pageH){
  const its=(items||[]).filter(it=>it && typeof it.str==='string' && it.str.length)
    .map(it=>{const t=it.transform||[1,0,0,1,0,0];return {s:it.str,x:t[4],y:t[5],w:it.width||0,h:Math.abs(t[3]||t[0]||10)};});
  if(!its.length)return [];
  its.sort((a,b)=>b.y-a.y || a.x-b.x);
  const rows=[]; let cur=null; const yTol=3;
  for(const it of its){
    if(cur && Math.abs(it.y-cur.y)<=yTol){ cur.items.push(it); cur.y=(cur.y*cur.items.length+it.y)/(cur.items.length+1); }
    else { cur={y:it.y,items:[it]}; rows.push(cur); }
  }
  const out=[];
  for(const r of rows){
    r.items.sort((a,b)=>a.x-b.x);
    let text='',prevEnd=null,x0=Infinity,x1=-Infinity,yTop=-Infinity,yBot=Infinity;
    const words=[];
    for(const it of r.items){
      if(pageW)words.push({s:it.s,a:Math.max(0,it.x/pageW),b:Math.min(1,(it.x+(it.w||0))/pageW)});
      if(prevEnd!=null){
        const gap=it.x-prevEnd;
        const approxChar=(it.w/Math.max(1,it.s.length))||3;
        if(gap>approxChar*0.4)text+=(gap>approxChar*3?'   ':' ');
      }
      text+=it.s; prevEnd=it.x+(it.w||0);
      x0=Math.min(x0,it.x); x1=Math.max(x1,it.x+(it.w||0));
      yTop=Math.max(yTop,it.y+(it.h||10)*0.85); yBot=Math.min(yBot,it.y-(it.h||10)*0.25);
    }
    text=text.replace(/\s+/g,' ').trim();
    if(!text||!isFinite(x0)||!pageW||!pageH)continue;
    // PDF space is bottom-up; flip to a top-down fraction so it drops straight
    // onto a normally-rendered <img> with no further transform at render time.
    out.push({text,x0n:Math.max(0,x0/pageW),x1n:Math.min(1,x1/pageW),y0n:Math.max(0,1-(yTop/pageH)),y1n:Math.min(1,1-(yBot/pageH)),words});
  }
  return out;
}
// Cap how many pages we rasterize+retain boxes for, purely to bound localStorage
// growth on very long multi-page reports -- Select Mode simply isn't offered
// beyond this page, Browse/parsing/trends are unaffected.
const DOC_PAGE_CAP=10;
async function extractPdfText(file,fileObj){
  if(!configurePdfEngine()){
    const err=new Error('The on-device PDF reader did not load. Refresh LabLens and try again.');
    err.code='PDF_ENGINE_UNAVAILABLE';
    throw err;
  }
  const buf=await file.arrayBuffer();const pdf=await pdfjsLib.getDocument({data:buf,isEvalSupported:false}).promise;
  if(pdf.numPages>100){await pdf.destroy();const err=new Error('This PDF has more than 100 pages. Split it into smaller files and try again.');err.code='PDF_PAGE_LIMIT';throw err;}
  let text='',ocrPages=0;
  const docPages=[];
  for(let i=1;i<=pdf.numPages;i++){
    setProgress((i-1)/pdf.numPages,'Reading PDF...',`${file.name} · page ${i}/${pdf.numPages}`);
    const page=await pdf.getPage(i);const content=await page.getTextContent();
    // Some PDFs (seen from at least one lab's generator) ship a font whose
    // ToUnicode CMap is broken for punctuation glyphs -- a printed "-" or ":"
    // decodes to U+0000 (NUL) instead. Left alone, this silently breaks every
    // "N - N" range regex in the parser (a range like "3.8 - 4.8" arrives as
    // "3.8 \u0000 4.8"), which doesn't error -- it just makes the value/range
    // matching latch onto the wrong number with no visible failure. NUL has no
    // legitimate use in report text, and "-" is the correct read in every
    // observed case (numeric ranges, and separator dashes in IDs like "MC-8007"),
    // so normalize it before anything else touches this page's text.
    content.items.forEach(it=>{if(it&&typeof it.str==='string'&&it.str.indexOf('\u0000')>=0)it.str=it.str.replace(/\u0000/g,'-');});
    let pageText=reconstructPdfLines(content.items).trim();
    // Match the stronger behavior from healthreport-ai-2: if a PDF page is scanned/no text-layer, render it and OCR it.
    let scannedFallback=false,ocrEvidence=null;
    // A sparse hidden text layer (such as a watermark) can coexist with a
    // scanned page. Do not treat a few unrelated text items as the whole report.
    const needsOcr=pageText.replace(/\s/g,'').length<12||(content.items.length<5&&pageText.length<200);
    if(needsOcr&&!window.Tesseract){const err=new Error(`The on-device OCR engine is unavailable for page ${i}. Refresh LabLens and try again.`);err.code='OCR_ENGINE_UNAVAILABLE';throw err}
    if(needsOcr){
      try{setProgress((i-1)/pdf.numPages,'OCR scanned PDF page...',`${file.name} · page ${i}/${pdf.numPages}`);const img=await renderPdfPageToImage(page,2);pageText=await aiOcrImage(img,`${file.name} page ${i}`);if(!pageText){const vp2=page.getViewport({scale:2});ocrEvidence={width:vp2.width,height:vp2.height};pageText=await ocrImage(img,p=>setProgress(((i-1)+p)/pdf.numPages,'OCR scanned PDF page...',`${file.name} · page ${i}/${pdf.numPages}`),ocrEvidence)}if(!pageText.trim())throw new Error('No text recognized');ocrPages++;scannedFallback=true;}
      catch(e){const err=new Error(`OCR could not read page ${i} of ${pdf.numPages}. Try a clearer scan or split the PDF.`);err.code='PDF_OCR_PAGE_FAILED';throw err}
    }
    text+=pageText+'\n';setProgress(i/pdf.numPages,'Reading PDF...',`${file.name} · page ${i}/${pdf.numPages}`);
    // §6: retain bounding boxes + a page image for the digital text-layer case only
    // (the highest-fidelity, most common "lab report" path) so Browse/Select mode
    // in the Document tab has something to hit-test against. Scanned pages still
    // get a page image (so the report is still viewable) but no boxes -- Select
    // Mode quietly has nothing to match there, which is an honest degradation
    // rather than a guessed position.
    if(fileObj && docPages.length<DOC_PAGE_CAP){
      try{
        const vp=page.getViewport({scale:1});
        const lines=scannedFallback?(ocrEvidence&&ocrEvidence.lines||[]):reconstructPdfLinesBoxed(content.items,vp.width,vp.height);
        const image=await renderPdfPageToImage(page,1.15,0.72);
        docPages.push({image,lines});
      }catch(e){console.warn('Could not capture page image/boxes for Select Mode',e)}
    }
  }
  if(ocrPages)showToast(`OCR used on ${ocrPages} scanned PDF page${ocrPages===1?'':'s'}`,'info');
  if(fileObj){fileObj.docPages=docPages;fileObj.ocrPages=ocrPages;}
  if(!text.trim()){
    const err=new Error('No readable text could be extracted. Try a clearer scan or export the PDF again.');
    err.code='PDF_TEXT_EMPTY';
    throw err;
  }
  return text;
}


async function readFileText(f){if(f.type==='pdf')return extractPdfText(f.file,f);setProgress(0,'Scanning image (OCR)...',f.name);try{f.imageDataURL=await fileToDataURL(f.file)}catch{}const aiTxt=await aiOcrImage(f.imageDataURL||f.file,f.name);if(aiTxt)return aiTxt;const evidence={};const text=await ocrImage(f.file,p=>setProgress(p,'Scanning image (OCR)...',f.name),evidence);f.ocrLines=evidence.lines||[];return text}
function normText(s){return String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();}
// The box of the value itself inside its row: the matching word when word boxes exist,
// otherwise an estimate from the value's character position in the row.
function locateValueBox(m,ln){
  const v=String(m.valueText!=null?m.valueText:m.value).trim();
  if(!v||!ln)return null;
  const num=v.replace(/^[<>≤≥=\s]+/,'');
  const words=ln.words||[];
  const hit=words.find(w=>w.s.trim()===v||w.s.trim()===num)||words.find(w=>w.s.includes(num)&&num.length>=2);
  if(hit)return {x0:hit.a,x1:hit.b,y0:ln.y0n,y1:ln.y1n};
  const t=String(ln.text||''),i=t.indexOf(num);
  if(i<0||!t.length)return null;
  const w=ln.x1n-ln.x0n;
  return {x0:ln.x0n+w*i/t.length,x1:ln.x0n+w*(i+num.length)/t.length,y0:ln.y0n,y1:ln.y1n};
}
function attachMetricBoxes(metrics,docPages){
  if(!Array.isArray(docPages)||!docPages.length||!Array.isArray(metrics)||!metrics.length)return;
  metrics.forEach(m=>{
    if(!m.srcLine)return;
    const target=normText(m.srcLine);
    if(!target)return;
    let best=null,bestScore=0;
    docPages.forEach((dp,pi)=>{
      (dp.lines||[]).forEach(ln=>{
        const lt=normText(ln.text);
        if(!lt)return;
        let score=0;
        if(lt===target)score=1;
        else if(lt.includes(target)||target.includes(lt))score=Math.min(target.length,lt.length)/Math.max(target.length,lt.length);
        if(score>bestScore){bestScore=score;best={pi,ln};}
      });
    });
    if(best&&bestScore>0.35){
      if(Number.isFinite(best.ln.confidence))m.ocrConfidence=best.ln.confidence;
      m.bboxPage=best.pi;
      if([best.ln.x0n,best.ln.y0n,best.ln.x1n,best.ln.y1n].every(Number.isFinite)){
        m.bbox={x0:best.ln.x0n,y0:best.ln.y0n,x1:best.ln.x1n,y1:best.ln.y1n};
        m.valBox=locateValueBox(m,best.ln);
      }
    }
  });
}
function attachOcrLineConfidence(metrics,lines){
  if(!Array.isArray(lines))return;
  for(const m of metrics){
    const source=normText(m.srcLine);if(!source)continue;
    const line=lines.find(l=>normText(l.text)===source);
    if(line&&Number.isFinite(line.confidence))m.ocrConfidence=line.confidence;
  }
}
function reviewMetricExtraction(m,sourceMode){
  const reasons=[];
  if(sourceMode==='ocr')reasons.push('read with OCR');
  if(Number.isFinite(m.ocrConfidence)&&m.ocrConfidence<0.85)reasons.push('low OCR confidence');
  if(m.curatedBy==='gemini')reasons.push('checked by AI, matched to the report text');
  if(m.qualifier)reasons.push('comparison symbol matters');
  if(m.valueText&&String(m.valueText)!==String(m.value))reasons.push('result is an interval');
  if(m.status==='unknown')reasons.push('no comparable reference range');
  if(m.status==='classifier')reasons.push('screening cutoff, not a normal range');
  m.reviewReasons=reasons;
  m.needsReview=reasons.length>0&&!m.verified;
}
function refreshVerification(a){
  (a.metrics||[]).forEach(m=>reviewMetricExtraction(m,a.sourceMode||'digital'));
  const pending=(a.metrics||[]).filter(m=>m.needsReview&&!m.flaggedWrong);
  a.verification={pendingCount:pending.length,totalCount:(a.metrics||[]).filter(m=>!m.flaggedWrong).length,sourceMode:a.sourceMode||'digital'};
  return a.verification;
}
function prettyMetricName(n){return String(n||'').replace(/\s+(?:[<>≤≥]=?|mg\/d[lL]|g\/d[lL]|ng\/m[lL]|u?IU\/m[lL]|mmol\/L|U\/L|%)\s*$/,'').replace(/\s+-([^-\s][^-]*?)-?(?=\s*(?:,|$))/g,' ($1)').replace(/\s+-([^-\s][^-]*?)-(?=\s)/g,' ($1)').replace(/-([A-Za-z0-9]{2,6})-(?=\/)/g,'($1)').replace(/\s{2,}/g,' ').trim()}
function prettyUnit(u){return /^fl$/i.test(String(u||'').trim())?'fL':u}
function buildAnalysis(metrics,fileName,rawText,cat,opts={}){metrics.forEach(m=>{if(m&&m.name){m.name=prettyMetricName(m.name);if(/\s-|-\s/.test(m.name)&&m.canonicalName)m.name=m.canonicalName}if(m&&m.unit)m.unit=prettyUnit(m.unit)});attachMetricBoxes(metrics,opts.docPages);attachOcrLineConfidence(metrics,opts.ocrLines);const sourceMode=opts.sourceMode||'digital';metrics.forEach(m=>reviewMetricExtraction(m,sourceMode));const normal=metrics.filter(m=>m.status==='normal'),high=metrics.filter(m=>m.status==='high'),low=metrics.filter(m=>m.status==='low');const _safe=metrics.filter(m=>severityTier(m)==='tier-safe'),_borderline=metrics.filter(m=>severityTier(m)==='tier-borderline'),_concern=metrics.filter(m=>severityTier(m)==='tier-concern');const picked=extractReportDate(rawText,fileName);const now=new Date().toISOString();const isImageOnly=!!(opts.scanImages&&opts.scanImages.length)&&metrics.length===0;const keepText=textLooksMeaningful(rawText,metrics,cat,isImageOnly);const cleanText=keepText?(rawText||'').slice(0,20000):'';cat=cat&&cat!=='auto'?cat:(keepText?detectCategory(cleanText,metrics.length>0,metrics):'other');
const _date=picked?picked.iso:now;
const _meds=[];
const _fu=extractFollowUp(rawText,cat,_date);
const _rx=null;
const analysis={medDrafts:_meds,followUp:_fu,opticalRx:_rx,id:Date.now()+Math.floor(Math.random()*9999),date:picked?picked.iso:now,analyzedAt:now,reportDateSource:picked?picked.label:'analysis date',fileName,category:cat,sourceMode,rawText:cleanText,ocrTextDiscarded:!keepText&&!!(rawText||'').trim(),scanImages:opts.scanImages||[],docPages:(opts.docPages||[]).map(p=>({image:p.image})),imageInterpretations:opts.imageInterpretations||[],metrics,totalMetrics:metrics.length,normalCount:normal.length,highCount:high.length,lowCount:low.length,outOfRangeCount:high.length+low.length,safeCount:_safe.length,borderlineCount:_borderline.length,concernCount:_concern.length,laymanSummary:cat==='lab'?layman(metrics,high,low):nonLabSummary(cat,cleanText,_meds,_fu,metrics),recommendations:cat==='lab'?recommendations(high,low):[{title:'Discuss with your clinician',desc:'Medical documents need clinical context. Share this report with the doctor who ordered it.'},{title:'Keep prior records',desc:'Previous reports and original images help clinicians compare changes over time.'}]};refreshVerification(analysis);return analysis}



/* ================= OPTICAL / SPECTACLE PRESCRIPTION =================
   The Lenskart invoice carries a table of the form:
     SPH   CYL   AXIS   PD   ADD
   RE  -5.50 -3.75  15   33   -
   LE  -7.25 -3.25  155  33   -
   These are the numbers glasses are cut to; they aren't lab values and must not
   be shown alongside blood tests. We store them as a small structured record.  */




/* ================= UPCOMING: next vaccine dose / follow-up visit =================
   Vaccination cards and discharge summaries carry the one thing the patient
   actually has to ACT on: a date. Surface it instead of burying it in text.     */
function extractFollowUp(text,cat,reportISO){
  const t=String(text||'');
  const base=reportISO?new Date(reportISO):new Date();
  const asISO=d=>isNaN(d)?null:d.toISOString();
  const parseAbs=str=>{
    let m=/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/.exec(str);
    if(m){let y=+m[3]; if(y<100)y+=2000; const d=new Date(y,(+m[2])-1,+m[1]); return isNaN(d)?null:d;}
    m=/(\d{4})-(\d{2})-(\d{2})/.exec(str); if(m)return new Date(+m[1],+m[2]-1,+m[3]);
    return null;
  };
  // 1) an explicit date: "Next due: 12/10/2026", "Follow up on 03/05/2026"
  let m=/(next\s*(?:dose|due|visit|appointment)|due\s*(?:on|date)|follow[\s-]?up(?:\s*(?:on|date))?|review\s*on|revisit\s*on)\s*[:\-]?\s*([^\n,;]{0,30})/i.exec(t);
  if(m){
    const d=parseAbs(m[2]);
    if(d&&d>new Date(base.getTime()-864e5))return {label:m[1].replace(/\s+/g,' ').trim(),iso:asISO(d),source:m[0].trim().slice(0,80)};
  }
  // 2) a relative interval: "review in 1 week", "follow up after 2 weeks"
  m=/(follow[\s-]?up|review|revisit|recheck|repeat)[^.\n]{0,20}?(?:in|after)\s*(\d{1,2})\s*(day|days|week|weeks|month|months|year|years)/i.exec(t);
  if(m){
    const n=+m[2], unit=m[3].toLowerCase();
    const d=new Date(base);
    if(unit.startsWith('day'))d.setDate(d.getDate()+n);
    else if(unit.startsWith('week'))d.setDate(d.getDate()+n*7);
    else if(unit.startsWith('month'))d.setMonth(d.getMonth()+n);
    else d.setFullYear(d.getFullYear()+n);
    return {label:m[1].replace(/\s+/g,' ').trim(),iso:asISO(d),source:m[0].trim().slice(0,80),estimated:true};
  }
  return null;
}
function upcomingItems(){
  const out=[];
  getHistory().forEach(r=>{
    if(r.followUp&&r.followUp.iso)out.push({
      when:r.followUp.iso, label:r.followUp.label||'Follow-up',
      cat:r.category, file:r.fileName, estimated:!!r.followUp.estimated, source:r.followUp.source||''
    });
  });
  const now=Date.now();
  return out.filter(x=>new Date(x.when).getTime()>=now-864e5)
            .sort((a,b)=>new Date(a.when)-new Date(b.when)).slice(0,6);
}
function renderUpcoming(){
  const el=$('upcomingStrip'); if(!el)return;
  const items=upcomingItems();
  if(!items.length){el.style.display='none';el.innerHTML='';return}
  el.style.display='block';
  el.innerHTML=`<div class="up-head">Coming up</div>`+items.map(x=>{
    const days=Math.ceil((new Date(x.when)-Date.now())/864e5);
    return `<div class="up-row"><span class="up-when">${fmtDate(x.when,{month:'short',day:'numeric',year:'numeric'})}</span>
      <span class="up-what">${esc(catMeta(x.cat).icon)} ${esc(x.label)}${x.estimated?' <span class="up-est">(estimated from the report wording)</span>':''}</span>
      <span class="up-in">${days<=0?'today':days===1?'tomorrow':'in '+days+' days'}</span></div>`;
  }).join('')+`<div class="up-note">Taken from your reports. Always confirm dates with your clinic.</div>`;
}


function nonLabSummary(cat,text,meds,fu,metrics){
  const L=esc(catMeta(cat).label);
  const bits=[];
  if(metrics&&metrics.length)bits.push(`<strong>${metrics.length}</strong> value(s) were read and can be tracked over time.`);

  if(meds&&meds.length)bits.push(`<strong>${meds.length}</strong> medicine(s) were found — check and confirm them in the Medicines tab.`);
  if(fu&&fu.iso)bits.push(`A <strong>${esc(fu.label)}</strong> looks due around <strong>${fmtDate(fu.iso,{month:'short',day:'numeric',year:'numeric'})}</strong>.`);
  if(text)bits.push('The full text has been saved and is searchable.');
  else bits.push('No readable text was found, so this is stored as an image only.');
  return `This is a <strong>${L}</strong> record. `+bits.join(' ');
}
function metricSignature(metrics){return (metrics||[]).map(m=>{const v=typeof m.value==='number'&&isFinite(m.value)?m.value.toFixed(3):String(m.value||'');return `${m.key}:${v}:${m.unit}`;}).sort().join('|')}
function reportSignature(a){return `${(a.category||'lab')}|${(a.date||'').slice(0,10)}|${metricSignature(a.metrics)}`}
function auditDuplicates(analysis){
  const existing=getHistory();const sig=reportSignature(analysis);
  const duplicateExisting=existing.find(r=>reportSignature(r)===sig);
  return {duplicateExisting,signature:sig};
}
function attachAnalysisAudit(a,uploadedCount,duplicateCount,skippedCount){a.audit={uploadedCount:uploadedCount||0,duplicateCount:duplicateCount||0,skippedCount:skippedCount||0,unitStandardized:(a.metrics||[]).filter(m=>m.unitStandardized).length,ocrEngine:window.__ocrEngineUsed||''};return a}
async function saveAnalysis(a){
  const dup=auditDuplicates(a).duplicateExisting;
  if(dup){dup.audit=Object.assign({},dup.audit||{},a.audit||{}, {duplicateExisting:true});currentAnalysis=dup;showToast('Duplicate report found — existing saved report opened instead.','info');updateUserInfoDisplay();return dup}
  const h=getHistory();h.unshift(a);h.sort((x,y)=>new Date(y.date)-new Date(x.date));
  if(!setHistory(h,{silent:true})){
    const hasImages=(a.scanImages||[]).length||(a.docPages||[]).length;
    const textOnly=hasImages&&await confirmDialog('Browser storage is full. Save extracted values and text without the original page images? You will still be able to review the values, but the image preview will not be available after reloading.');
    if(!textOnly)throw new Error('Browser storage is full; this report was not saved. Free space or use a smaller file, then try again.');
    a.scanImages=[];a.docPages=[];
    if(!setHistory(h,{silent:true}))throw new Error('Browser storage is full; this report was not saved. Free space, then try again.');
  }
  currentAnalysis=a;updateUserInfoDisplay();return a;
}

/* ============== IDENTITY DISCREPANCY CHECK ==============
   Detects patient name/gender/age from the report text, compares leniently
   against the active profile, and if there's a mismatch asks the user
   "Is this your report?" with options to clarify, ignore, or create a new
   pre-filled profile. This is non-blocking: it returns a Promise that
   resolves to {action:'keep'|'update'|'new', profile?} so analyzeReport
   can await it before saving.                                       */
let __idPending=null; // {resolve, reject, detected, discrepancies, clarifications}

function extractPatientIdentity(text, fileName){
  const t=' '+String(text||'').replace(/\s+/g,' ')+' ';
  const out={name:null, nameRaw:null, sex:null, sexRaw:null, age:null, ageRaw:null, dob:null};

  // ---------- name (line-aware: the collapsed text above loses line breaks) ----------
  const _lines=String(text||'').split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  const _cutName=v=>v.replace(/\s+(?:report|registration|reg\.?|age|sex|gender|date|ref|referred|collected|received|barcode|patient\s*id|id|mobile|phone|dob)\b.*$/i,'').replace(/^(?:mr|mrs|ms|miss|dr|master|shri|smt|prof)\.?\s+/i,'').replace(/[\s:;,-]+$/,'').trim();
  for(const l of _lines){
    const m0=/^[\s:;.,-]*(?:patient\s+)?(?:name|full\s*name)\s*[:\-]\s*(.{2,80})$/i.exec(l);
    if(m0){const c=_cutName(m0[1]);if(c.length>=2&&/[A-Za-z]{2}/.test(c)){out.nameRaw=c.slice(0,60);out.name=c.slice(0,60);break}}
  }
  if(!out.name){
    // Unlabelled banner: "Sejal Hemal Mehta" directly above "53 Year(s)/Female".
    for(let i=0;i<_lines.length-1;i++){
      if(/^[A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){1,3}$/.test(_lines[i])&&/^\d{1,3}\s*(?:year|yr|y\b)/i.test(_lines[i+1])&&!/\b(?:report|laboratory|labs?|health|diagnostics|hospital|clinic|panel|profile|index)\b/i.test(_lines[i])){out.nameRaw=_lines[i];out.name=_lines[i];break}
    }
  }
  // ---------- name ----------
  // Lab reports usually print: Name: John Doe / Patient Name : ... / NAME - JOHN DOE
  const nameRe=/(?:^|[\n\r])\s*(?:patient\s+)?(?:name|full\s*name)\s*[:\-]\s*([^\n\r]{2,60})/i;
  let m=out.name?null:nameRe.exec(t);
  if(m){
    out.nameRaw=m[1].trim().replace(/\s{2,}/g,' ').slice(0,60);
    // trim trailing junk (MRN/ID/age/sex tokens that were on same line)
    let cleaned=out.nameRaw.replace(/(?:\b(?:age|sex|gender|mrn|id|uhid|pid|reg|mobile|phone|dob|d\.o\.b|address|ward|bed)\b[:\s].*)$/i,'').trim();
    cleaned=cleaned.replace(/\s*[|/]\s*(?:m|f|male|female|\d{1,3}\s*(?:y|yrs|years))$/i,'').trim();
    cleaned=cleaned.replace(/\s+(?:mr|mrs|ms|dr|master|miss|shri|smt|m\/s)\.?\s*$/i,'').trim();
    // strip leading salutations
    cleaned=cleaned.replace(/^(?:mr|mrs|ms|miss|dr|master|shri|smt|prof|er|er|m\/s)\.?\s+/i,'').trim();
    if(cleaned.length>=2) out.name=cleaned;
  }
  // fallback: "Patient: John Doe" style first non-numeric line after "Patient"
  if(!out.name){
    const pRe=/(?:^|[\n\r])\s*patient\s*[:\-]?\s*([A-Za-z][A-Za-z .'-]{1,50})/i;
    m=pRe.exec(t);
    if(m){
      let cand=m[1].trim().replace(/\s+/g,' ');
      cand=cand.replace(/^(?:mr|mrs|ms|miss|dr|master|shri|smt)\.?\s+/i,'').trim();
      if(cand.length>=2 && !/\b(name|id|age|sex|no)\b/i.test(cand)) out.name=cand;
    }
  }
  // fallback 2: Look for any line starting with a common salutation (Mr., Mrs., Ms., Dr., Master, Miss)
  if(!out.name){
    const salutationRe = /(?:^|[\n\r])\s*(?:mr|mrs|ms|miss|dr|master|shri|smt)\.?\s+([A-Za-z][A-Za-z .'-]{1,50})/i;
    m = salutationRe.exec(t);
    if(m){
      let cand = m[1].trim().replace(/\s+/g,' ');
      cand = cand.replace(/^(?:mr|mrs|ms|miss|dr|master|shri|smt)\.?\s+/i,'').trim();
      if(cand.length>=2 && !/\b(name|id|age|sex|no|report|date|collected|reported|received)\b/i.test(cand)){
        const raw_match = m[0].trim();
        let cleaned = raw_match.replace(/^\s+/,'').replace(/\s+$/,'');
        if(cleaned.length>=4) out.name = cleaned;
      }
    }
  }

  // ---------- sex / gender ----------
  const sexRe=/(?:sex|gender)\s*[:\-\/\s]{0,6}(?:\d{1,3}\s*(?:years?|yrs?|y)\b\s*[:\-\/\s]{0,6})?(male|female|m|f|other)\b/i;
  m=sexRe.exec(t);
  if(m){
    out.sexRaw=m[1].trim();
    const s=out.sexRaw.toLowerCase();
    if(s.startsWith('m')) out.sex='male';
    else if(s.startsWith('f')) out.sex='female';
  }

  if(!out.sex){const ms=/\d{1,3}\s*(?:year\(s\)|(?:years?|yrs?|y)\b)\s*[\/,|-]?\s*(male|female|m|f)\b/i.exec(t);if(ms){out.sexRaw=ms[1];out.sex=ms[1].toLowerCase().startsWith('m')?'male':'female'}}
  // ---------- age ----------
  // "Age: 34 Years" / "45 Y / M" / "Age/Sex: 34/Male"
  const ageRe=/(?:^|[\s\n])(?:age\s*[:\-]?\s*:?\s*)?(\d{1,3})\s*(?:year\(s\)|(?:years?|yrs?|y)\b)/gi;
  let best=null;
  while((m=ageRe.exec(t))){
    const a=parseInt(m[1],10);
    if(a>=0&&a<=120){
      // prefer matches close to the word "age"
      const ctx=t.slice(Math.max(0,m.index-20),m.index+m[0].length).toLowerCase();
      // Prefer the banner near the top of the report; ignore ages quoted in prose such as
      // "age > 14yrs" or "age upto 14yrs" (eGFR footnotes).
      const before=t.slice(Math.max(0,m.index-14),m.index).toLowerCase();
      const score=(/age/.test(ctx)?2:0)+(a>=1&&a<=110?1:0)+(m.index<900?3:0)-(/[<>]|upto|up to|above|below|over|under/.test(before)?5:0);
      if(!best||score>best.score) best={a,score};
    }
  }
  if(best) out.age=best.a;
  else{const ma=/\bage\s*[:\-]?\s*(\d{1,3})\b(?!\s*\/)/i.exec(t);if(ma&&+ma[1]<=120)out.age=+ma[1]}

  // explicit "Age : 45 Years / Sex : Male" patterns
  const ageSexRe=/age\s*[/:]?\s*sex\s*[:\-]?\s*(\d{1,3})\s*\/?\s*(m|f|male|female)?/i;
  m=ageSexRe.exec(t);
  if(m){
    const a=parseInt(m[1],10);
    if(a>=0&&a<=120) out.age=a;
    if(m[2]){
      const s=m[2].toLowerCase();
      out.sex=s.startsWith('m')?'male':'female'; out.sexRaw=m[2];
    }
  }
  // "45/M" style shorthand after age/name labels
  const slashRe=/(\d{1,3})\s*\/\s*(m|f|male|female)\b/i;
  m=slashRe.exec(t);
  if(m){
    const a=parseInt(m[1],10);
    if(a>=0&&a<=120 && !out.age) out.age=a;
    if(!out.sex){ out.sex=m[2].toLowerCase().startsWith('m')?'male':'female'; out.sexRaw=m[2]; }
  }

  // ---------- DOB ----------
  const dobRe=/(?:d\.?o\.?b\.?|date\s*of\s*birth|birth\s*date)\s*[:\-]?\s*(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}|\d{4}[\/\-.]\d{1,2}[\/\-.]\d{1,2}|(?:\d{1,2}\s*[- ])?[A-Za-z]{3,9}\s*[- ]\d{2,4})/i;
  m=dobRe.exec(t);
  if(m){
    out.dob=m[1].trim();
    if(!out.age){
      // try to compute approximate age from DOB
      const dt=parseLooseDate(m[1]);
      if(dt){
        const now=new Date();
        let ay=now.getFullYear()-dt.getFullYear();
        if(now.getMonth()<dt.getMonth()||(now.getMonth()===dt.getMonth()&&now.getDate()<dt.getDate())) ay--;
        if(ay>=0&&ay<=120) out.age=ay;
      }
    }
  }

  // if DOB not found but we have age, estimate DOB year (just for pre-fill)
  if(!out.dob && out.age!=null){
    const now=new Date();
    const y=now.getFullYear()-out.age;
    out.estDob=`${y}-01-01`;
  }
  return out;
}
function parseLooseDate(str){
  const s=String(str||'').trim();
  let m=/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/.exec(s);
  if(m){
    let y=+m[3]; if(y<100)y+=y<50?2000:1900;
    const d=new Date(y,(+m[2])-1,+m[1]); if(!isNaN(d))return d;
  }
  m=/(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/.exec(s);
  if(m){ const d=new Date(+m[1],(+m[2])-1,+m[3]); if(!isNaN(d))return d; }
  m=/(\d{1,2})\s*[- ]?\s*([A-Za-z]{3,9})\s*[- ]?\s*(\d{2,4})/.exec(s);
  if(m && MONTHS[m[2].toLowerCase()]!=null){
    let y=+m[3]; if(y<100)y+=y<50?2000:1900;
    const d=new Date(y,MONTHS[m[2].toLowerCase()],+m[1]); if(!isNaN(d))return d;
  }
  return null;
}

// Lenient name compare: allow initials, different order, missing middle,
// different casing/spacing. Returns 0..1 score; >=0.6 = "close enough".
function nameSimilarity(a,b){
  const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
  const na=norm(a), nb=norm(b);
  if(!na||!nb)return 0;
  if(na===nb)return 1;
  const toks=x=>x.split(' ').filter(w=>w.length>0);
  const ta=toks(na), tb=toks(nb);
  if(ta.length && tb.length){
    // one-word check: if one side is a substring of the other
    if(ta.length===1 && tb.some(w=>w.startsWith(ta[0])||ta[0].startsWith(w))) return 0.75;
    if(tb.length===1 && ta.some(w=>w.startsWith(tb[0])||tb[0].startsWith(w))) return 0.75;
    // initials match: "john d" vs "john doe"
    const initMatch=ta.every(wa=>tb.some(wb=>{
      if(wa.length===1) return wb.startsWith(wa);
      if(wb.length===1) return wa.startsWith(wb);
      return wa===wb || wa.startsWith(wb) || wb.startsWith(wa);
    }));
    if(initMatch) return 0.8;
    // token overlap (Jaccard-ish)
    let hit=0;
    ta.forEach(wa=>{ if(tb.some(wb=>wa===wb||wa.startsWith(wb)||wb.startsWith(wa))) hit++; });
    tb.forEach(wb=>{ if(ta.some(wa=>wa===wb||wa.startsWith(wb)||wb.startsWith(wa))) hit++; });
    const score=hit/(ta.length+tb.length);
    return score;
  }
  // substring
  if(na.includes(nb)||nb.includes(na))return 0.7;
  return 0;
}

// Run after an analysis is built but before it is saved/displayed.
// Resolves with action: 'continue' -> save as-is, 'new' -> switch user then save
let __idCheckQueue=[];

/* ============== GUEST -> PROFILE ==============
   After a report is read in Guest mode we offer to save it to a profile,
   pre-filled with the name, sex and age found on the report. The user can edit
   every field before anything is saved. Resolves 'created' or 'skipped'. */
let __gpPending=null;
const titleCase=n=>String(n||'').toLowerCase().replace(/\b([a-z])/g,c=>c.toUpperCase()).replace(/\s+/g,' ').trim();
function offerGuestProfile(a){
  return new Promise(resolve=>{
    if(LS.get('lablens_guest_prompt_off',false)===true)return resolve('skipped');
    const d=a.detectedPatient||extractPatientIdentity(a.rawText||'',a.fileName||'');
    __gpPending={resolve,analysis:a};
    $('gpName').value=titleCase(d.name||'');
    $('gpSex').value=(d.sex==='male'||d.sex==='female')?d.sex:'';
    $('gpAge').value=d.age!=null?d.age:'';
    $('gpDob').value='';
    $('gpNever').checked=false;
    const tg=$('gpTarget'),wrap=$('gpTargetWrap');
    wrap.hidden=!users.length;
    tg.innerHTML='<option value="__new">New profile</option>'+users.map(u=>`<option value="${esc(u.username)}">${esc(u.username)}</option>`).join('');
    const words=n=>String(n||'').toLowerCase().split(/[^a-z]+/).filter(w=>w.length>1);
    const overlap=(a,b)=>{const x=words(a),y=words(b);return x.length&&y.length&&(x.every(w=>y.includes(w))||y.every(w=>x.includes(w)))};
    const guess=d.name?(users.find(u=>u.username.toLowerCase()===d.name.toLowerCase())||users.find(u=>overlap(u.username,d.name))||users.find(u=>nameSimilarity(u.username,d.name)>=0.6)):null;
    tg.value=guess?guess.username:'__new';
    gpTargetChanged();
    $('progressSection').classList.remove('active');
    $('guestProfileModal').classList.add('active');
  });
}
function gpTargetChanged(){
  const t=$('gpTarget').value,isNew=t==='__new';
  $('gpNewFields').hidden=!isNew;
  ['gpName','gpSex','gpAge'].forEach(id=>{$(id).required=isNew});
  $('gpSaveBtn').textContent=isNew?'Save profile and show results':`Save to ${t} and show results`;
}
function guestProfileClose(result){
  const g=__gpPending;__gpPending=null;
  $('guestProfileModal').classList.remove('active');
  if(g)g.resolve(result);
}
function guestProfileSkip(){
  if($('gpNever').checked)LS.set('lablens_guest_prompt_off',true);
  guestProfileClose('skipped');
}
function guestProfileSave(e){
  e.preventDefault();
  const g=__gpPending;if(!g)return;
  const target=$('gpTarget').value;
  if(target!=='__new'){
    $('userSelect').value=target;switchUser(target);
    if($('gpNever').checked)LS.set('lablens_guest_prompt_off',true);
    guestProfileClose('created');
    showToast(`Saved to ${target}`,'success');
    return;
  }
  const username=$('gpName').value.trim(),sex=$('gpSex').value,dobIn=$('gpDob').value,age=parseInt($('gpAge').value,10);
  if(!username)return showToast('Please enter a name','error');
  if(!sex)return showToast('Please choose sex at birth','error');
  const existing=users.find(u=>u.username.toLowerCase()===username.toLowerCase());
  if(existing){
    // The profile already exists: save this report to it instead of refusing.
    $('userSelect').value=existing.username;switchUser(existing.username);
    if($('gpNever').checked)LS.set('lablens_guest_prompt_off',true);
    guestProfileClose('created');
    showToast(`Saved to ${existing.username}`,'success');
    return;
  }
  const reportYear=new Date(g.analysis.date||Date.now()).getFullYear();
  let dob=dobIn;
  if(!dob){
    if(!(age>=0&&age<=120))return showToast('Enter an age or a date of birth','error');
    dob=`${reportYear-age}-01-01`;
  }
  const nickname=(username.split(/\s+/)[0]||username).slice(0,10);
  users.push({username,nickname,sex,dob,createdAt:new Date().toISOString(),fromReport:true});
  LS.set('healthUsers',users);
  renderUserSelect();$('userSelect').value=username;switchUser(username);
  if($('gpNever').checked)LS.del('lablens_guest_prompt_off');
  guestProfileClose('created');
  showToast(`Profile “${username}” created`,'success');
}
function checkIdentityForAnalysis(a){
  return new Promise(resolve=>{
    const p=currentProfile();
    const detected=extractPatientIdentity(a.rawText||'', a.fileName||'');
    a.detectedPatient=detected;
    // If no identity info detected at all, nothing to ask about.
    const hasAny=detected.name||detected.sex||(detected.age!=null);
    if(!hasAny&&currentUser){ return resolve({action:'continue'}); }

    const discrepancies=[];
    // Name comparison - lenient.
    if(detected.name && p && p.username){
      const sim=nameSimilarity(p.username, detected.name);
      if(sim<0.6){
        discrepancies.push({field:'name', profile:p.username, report:detected.name, sim});
      }
    }
    // Sex comparison - strict (only flag if both are known and differ AND not "unspecified")
    if(detected.sex && p && p.sex && p.sex!=='unspecified' && detected.sex!==p.sex){
      discrepancies.push({field:'sex', profile:p.sex, report:detected.sex});
    }
    // Guest: offer to save the report to a profile, pre-filled from the report.
    if(!currentUser){ offerGuestProfile(a).then(r=>resolve({action:r==='created'?'continue-newuser':'continue'})); return; }

    if(!discrepancies.length){ return resolve({action:'continue'}); }

    // Otherwise, ask.
    openIdentityModal(detected, discrepancies, resolve);
  });
}

function openIdentityModal(detected, discrepancies, resolve){
  __idPending={detected, discrepancies, resolve, stage:'ask', choices:{}};
  const p=currentProfile();
  // Build comparison box
  const showField=(label, prof, rep)=>{
    return `<div class="identity-row"><span class="identity-label">${label}</span><span class="identity-val profile">${esc(prof||'—')}</span><span class="identity-arrow">→</span><span class="identity-val report">${esc(rep||'—')}</span></div>`;
  };
  const cap=s=>s?s.charAt(0).toUpperCase()+s.slice(1):s;
  let html='';
  discrepancies.forEach(d=>{
    const profLabel=d.field==='name'?(p?p.username:'') : (d.field==='sex'?(p?cap(p.sex):''):d.profile);
    const repLabel=d.field==='name'?(detected.name||'') : (d.field==='sex'?cap(detected.sex||''):d.report);
    const lbl=d.field==='name'?'Name':d.field==='sex'?'Sex':'Age';
    html+=showField(lbl, profLabel, repLabel);
  });
  // Show age if present but no discrepancy flagged (context)
  if(detected.age!=null){
    const pAge=p && p.dob ? ageYears(p.dob) : null;
    const pAgeStr=pAge!=null?String(pAge)+' years':'—';
    const rAgeStr=detected.age+' years'+(detected.ageRaw?' ('+esc(detected.ageRaw)+')':'');
    if(pAge!=null && Math.abs(pAge-detected.age)>=5){
      html+=showField('Age (≈)', pAgeStr, rAgeStr);
      discrepancies.push({field:'age', profile:pAgeStr, report:rAgeStr});
    }
  }
  $('idCompareBox').innerHTML=html;
  // Intro text
  $('idIntro').innerHTML='We read the report you uploaded and noticed some identifying details differ from the currently selected profile:';
  // Discrepancy note
  const fields=discrepancies.map(d=>d.field==='name'?'<strong>name</strong>':d.field==='sex'?'<strong>sex</strong>':'<strong>age</strong>').join(', ');
  $('idDiscrepancyNote').style.display='block';
  $('idDiscrepancyNote').innerHTML=`The ${fields} on the report doesn't look like the profile <strong>${esc(p?p.username:'Guest')}</strong>. This can mean the report belongs to someone else, or there's a small OCR/read error. Please confirm before we save it.`;
  // Stage = ask
  showIdStage('ask');
  $('identityModal').classList.add('active');
}
function showIdStage(stage){
  if(!__idPending)return;
  __idPending.stage=stage;
  $('idAskStage').style.display=stage==='ask'?'block':'none';
  $('idClarifyStage').style.display=stage==='clarify'?'block':'none';
  $('idNewProfileStage').style.display=stage==='new'?'block':'none';
}
function idAnswerYes(){
  // Show clarification step: pick for each mismatched field
  if(!__idPending)return;
  const {detected, discrepancies}=__idPending;
  const p=currentProfile();
  let html='';
  discrepancies.forEach(d=>{
    const key=d.field;
    __idPending.choices[key]='keep'; // default
    const cap=s=>s?s.charAt(0).toUpperCase()+s.slice(1):s;
    const profVal=d.field==='name'?(p?p.username:'') : (d.field==='sex'?(p?cap(p.sex):'') : d.profile);
    const repVal=d.field==='name'?(detected.name||'') : (d.field==='sex'?cap(detected.sex||'') : d.report);
    const lbl=d.field==='name'?'Name':d.field==='sex'?'Sex':'Age';
    html+=`<div class="id-choice"><label>${lbl}</label>
      <div class="id-swap">
        <button type="button" class="id-opt active-keep" id="idOpt-keep-${key}" onclick="idPickField('${key}','keep')">Keep profile: <strong>${esc(profVal)}</strong></button>
        <button type="button" class="id-opt" id="idOpt-report-${key}" onclick="idPickField('${key}','report')">Use report: <strong>${esc(repVal)}</strong></button>
      </div>
    </div>`;
  });
  $('idChoices').innerHTML=html;
  showIdStage('clarify');
}
function idPickField(field,which){
  if(!__idPending)return;
  __idPending.choices[field]=which;
  const k=document.getElementById('idOpt-keep-'+field);
  const r=document.getElementById('idOpt-report-'+field);
  if(k){k.classList.remove('active-report');k.classList.add('active-keep')}
  if(r){r.classList.remove('active-keep');r.classList.add('active-report')}
}
function idCancelClarify(){ showIdStage('ask'); }
function idConfirmClarify(){
  if(!__idPending)return;
  const {detected, discrepancies, choices, resolve}=__idPending;
  const p=currentProfile();
  let updated=false;
  discrepancies.forEach(d=>{
    if(choices[d.field]==='report' && p){
      if(d.field==='name'){
        // don't rename the profile silently; leave username alone but remember as alias
        p.reportName=detected.name;
      }else if(d.field==='sex'){
        p.sex=detected.sex; updated=true;
      }
    }
  });
  if(updated){
    // persist
    const all=LS.get('healthUsers',[]);
    const idx=all.findIndex(u=>u.username===p.username);
    if(idx>=0){ all[idx]=p; LS.set('healthUsers',all); users=all; }
  }
  closeIdentityModal();
  resolve({action:'continue'});
}
function idAnswerNew(){
  if(!__idPending)return;
  const {detected}=__idPending;
  $('idNewName').value=detected.name||'';
  $('idNewSex').value=detected.sex==='male'||detected.sex==='female'?detected.sex:'';
  // DOB: prefer explicit DOB, else estimated from age
  let preDob='';
  if(detected.dob){
    const dt=parseLooseDate(detected.dob);
    if(dt)preDob=dt.toISOString().slice(0,10);
  }
  if(!preDob && detected.estDob) preDob=detected.estDob;
  $('idNewDob').value=preDob;
  $('idNewDob').max=new Date().toISOString().slice(0,10);
  showIdStage('new');
  setTimeout(()=>$('idNewName').focus(),50);
}
function idCancelNew(){ showIdStage('ask'); }
function idCreateNewProfile(){
  if(!__idPending)return;
  const pend=__idPending;
  const username=$('idNewName').value.trim();
  const sex=$('idNewSex').value;
  const dob=$('idNewDob').value;
  if(!username)return showToast('Please enter a name','error');
  if(!sex)return showToast('Please choose sex','error');
  if(!dob)return showToast('Please enter date of birth','error');
  const dupe=users.find(u=>u.username.toLowerCase()===username.toLowerCase());
  if(dupe){
    // Already a profile with this name: save the report to it.
    $('userSelect').value=dupe.username;switchUser(dupe.username);
    closeIdentityModal();
    showToast(`Saved to ${dupe.username}`,'success');
    pend.resolve({action:'continue-newuser'});
    return;
  }
  const newUser={username,sex,dob,createdAt:new Date().toISOString(),fromReport:true};
  users.push(newUser); LS.set('healthUsers',users);
  renderUserSelect();
  $('userSelect').value=username;
  switchUser(username);
  closeIdentityModal();

  pend.resolve({action:'continue-newuser'});
}
function idAnswerSkip(){
  const pend=__idPending;
  if(!pend)return;
  closeIdentityModal();   // clears __idPending, so resolve through the captured copy
  pend.resolve({action:'continue'});
}
function closeIdentityModal(){
  $('identityModal').classList.remove('active');
  __idPending=null;
}


/* ================= OPTIONAL: GEMINI CURATION (de-identified) =================
   Off by default. OCR and PDF parsing always happen on this device. When the
   user opts in, only de-identified result text plus age and sex is sent to our
   serverless proxy, which asks Gemini for a curated parameter list. Every row
   that comes back is checked against the text we sent; rows that cannot be
   found in it are dropped. Any failure falls back to the on-device parser. */
const CURATE_KEY='lablens_gemini_curation';
const curationCache=new Map();
function curationEnabled(){return LS.get(CURATE_KEY,false)===true}
function curationNames(text,fileName){
  const idn=extractPatientIdentity(text,fileName),p=currentProfile();
  return {idn,names:[idn.nameRaw,idn.name,p&&p.name,p&&p.username,fileName&&String(fileName).replace(/\.[a-z0-9]+$/i,'').replace(/[_-]+/g,' ')].filter(Boolean)};
}
function buildCurationPayload(text,fileName,ctx){
  const {idn,names}=curationNames(text,fileName);
  const demo=LabLensDeid.demographics(ctx&&ctx.age!=null?ctx.age:idn.age,ctx&&ctx.sex?ctx.sex:idn.sex);
  const d=LabLensDeid.deidentify(text,{names});
  return {body:{text:d.text,age:demo.age,sex:demo.sex},stats:d.stats};
}
// Long reports are mostly interpretation prose. Result rows are short, so drop long
// sentences that carry no measurement, then send what is left in bounded chunks.
function condenseForCuration(text){
  const measure=/\d\s*(?:g\/|mg|gm|ng|pg|pmol|nmol|umol|u\/|miu|uiu|mmol|ug|iu|%|fl|sec|mil|cell|10\s*\^|\/u?l|\/m[lL]|mm\/hr|\/hpf|\/cumm)|\d\s*[-–]\s*\d|[<>]\s*=?\s*\d/i;
  return text.split('\n').filter(l=>{const words=(l.match(/[A-Za-z]{2,}/g)||[]).length;return words<16||measure.test(l)&&words<26}).join('\n');
}
function chunkLines(text,max){
  const out=[];let cur='';
  for(const l of text.split('\n')){
    if(cur&&cur.length+l.length+1>max){out.push(cur);cur=''}
    cur+=(cur?'\n':'')+l;
  }
  if(cur)out.push(cur);
  return out;
}
function confirmCurationPayload(body){
  const dialog=$('curationConsent');
  $('curationConsentMeta').textContent=`Age: ${body.age??'not shared'} · Sex: ${body.sex??'not shared'} · ${body.text.length} characters`;
  $('curationConsentText').textContent=body.text;
  dialog.returnValue='';
  return new Promise(resolve=>{
    dialog.addEventListener('close',()=>resolve(dialog.returnValue==='send'),{once:true});
    dialog.showModal();
  });
}
async function fetchCuratedRows(text,fileName,ctx){
  const {body,stats}=buildCurationPayload(text,fileName,ctx);
  body.text=condenseForCuration(body.text);
  if(!body.text.trim())throw new Error('nothing to send');
  const cacheKey=body.text+'|'+body.age+'|'+body.sex;
  if(curationCache.has(cacheKey))return curationCache.get(cacheKey);
  const curateUrl='/api/curate';
  if(!await confirmCurationPayload(body)){
    const e=new Error('AI checking skipped by user');e.code='curation_declined';throw e;
  }
  const chunks=chunkLines(body.text,5000).slice(0,10);
  const send=async chunk=>{
    const res=await fetch(curateUrl,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text:chunk,age:body.age,sex:body.sex}),signal:AbortSignal.timeout(45000)});
    if(!res.ok){const e=new Error('curation '+res.status);e.status=res.status;throw e}
    return res.json();
  };
  // One retry per chunk; a chunk that still fails is simply covered by the on-device parser.
  const settled=await Promise.allSettled(chunks.map(c=>send(c).catch(()=>send(c))));
  const parts=settled.filter(r=>r.status==='fulfilled').map(r=>r.value);
  if(!parts.length)throw settled[0].reason||new Error('curation failed');
  const out={rows:parts.flatMap(d=>d.parameters||[]),isLab:parts.some(d=>d.isLabReport),sent:body,stats,failedChunks:settled.length-parts.length};
  curationCache.set(cacheKey,out);
  {const l=document.getElementById('curateLast');if(l)l.hidden=false}
  window.__lastCuration={sent:body,stats,returned:out.rows.length,requests:chunks.length,failed:out.failedChunks};
  return out;
}
function curatedRowsToMetrics(rows,sentText,fullText,P){
  const sourceIdentity=s=>String(s||'').toLowerCase().replace(/\s+/g,' ').trim();
  const sentLines=new Set(String(sentText||'').split(/\r?\n/).map(sourceIdentity));
  const lines=String(fullText||'').split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  const seen=new Set(),out=[];
  let dropped=0;
  for(const r of rows){
    const name=String(r.name||'').trim(),src=String(r.sourceLine||'').trim();
    if(!name||!src)continue;
    const val=(typeof r.value==='number'&&isFinite(r.value))?r.value:null;
    const srcNorm=normText(src);
    // Require the actual line sent to Gemini. Normalizing punctuation here made
    // "1.2" and "1,2" indistinguishable and could validate a changed result.
    if(!srcNorm||!sentLines.has(sourceIdentity(src))){dropped++;continue}
    if(val!=null&&String(Math.trunc(Math.abs(val))).length>7){dropped++;continue}
    const std=matchTest(name);
    // Same key scheme as the on-device parser, so a marker trends across reports whichever path read it.
    const slug=name.toLowerCase().replace(/[^a-z0-9]+/g,'_');
    const key=val==null?'qual:'+slug:(std?std.key:'x:'+slug);
    if(!key||seen.has(key))continue;
    const idx=lines.findIndex(l=>sourceIdentity(l)===sourceIdentity(src));
    const srcLine=(idx>=0?lines[idx]:src).slice(0,180);
    let lo=Number.isFinite(r.refLow)?r.refLow:null,hi=Number.isFinite(r.refHigh)?r.refHigh:null;
    let hasRef=lo!=null||hi!=null;
    let unit=(r.unit||'').trim()||(std&&std.unit)||'';
    const base={key,name:name.slice(0,80),canonicalName:std?std.name:name,group:std?std.group||'other':'other',qualifier:r.qualifier==='<'||r.qualifier==='>'?r.qualifier:undefined,unit,srcLine,srcIndex:idx,curatedBy:'gemini'};
    if(val==null){
      const t=String(r.valueText||'').trim();
      if(!t)continue;
      const localQual=parseReportText(src,P).find(m=>m.key===key&&typeof m.value==='string');
      if(!localQual||normText(localQual.value)!==normText(t)||
         (r.refText&&!sourceIdentity(src).includes(sourceIdentity(r.refText)))){dropped++;continue}
      seen.add(key);
      out.push({...localQual,...base,value:t.slice(0,60),srcLine,srcIndex:idx,curatedBy:'gemini'});
      continue;
    }
    // The model checks the parser, but it cannot create a number, unit or range
    // from another column. Keep only numeric rows corroborated by local parsing.
    const evidence=parseReportText(src,P).find(m=>m.key===key&&typeof m.value==='number');
    if(!evidence||evidence.value!==val||
       (r.unit&&!comparableUnit(r.unit,evidence.unit))||
       (lo!=null&&(!evidence.refFromReport||lo!==evidence.min))||
       (hi!=null&&(!evidence.refFromReport||hi!==evidence.max))){dropped++;continue}
    seen.add(key);
    out.push({...evidence,...base,value:val,unit:evidence.unit,qualifier:evidence.qualifier,srcLine,srcIndex:idx,curatedBy:'gemini'});
  }
  out.dropped=dropped;
  return out;
}
// A non-numeric result is abnormal when it differs from the printed reference ("Reactive" vs "Non Reactive").
function qualStatus(value,ref){
  if(!ref||/\d/.test(value)||/\d/.test(ref))return 'unknown';
  return normText(value)===normText(ref)?'normal':'high';
}
function rangeText(min,max,unit){
  const u=unit?` ${unit}`:'';
  if(min!=null&&max!=null&&isFinite(max))return `${min} - ${max}${u}`;
  if(max!=null&&isFinite(max))return `< ${max}${u}`;
  return `> ${min}${u}`;
}
// One entry point for every analysis path: local parse first, Gemini curation on top when opted in.
async function extractMetrics(text,fileName,dGuess){
  const P=profileContext(dGuess?dGuess.iso:null);
  const local=parseReportText(text,P);
  if(!curationEnabled())return local;
  try{
    setProgress(0.5,'Checking values with AI','Only de-identified results, age and sex are sent');
    const c=await fetchCuratedRows(text,fileName,P);
    if(!c.isLab)return local;
    const curated=curatedRowsToMetrics(c.rows,c.sent.text,text,P);
    if(!curated.length)return local;
    // Gemini wins on names and units, but never loses a range the on-device parser already resolved
    // (for example tiered Vitamin D cut-offs that are not a single low-high pair).
    const localByKey=new Map(local.map(m=>[m.key,m]));
    const merged=curated.map(m=>{const l=localByKey.get(m.key);return (m.status==='unknown'&&l&&l.status!=='unknown')?l:m});
    const have=new Set(merged.map(m=>m.key));
    return merged.concat(local.filter(m=>!have.has(m.key)));
  }catch(e){
    if(e&&e.code==='curation_declined'){
      showToast('AI checking skipped. Using on-device results.','info');
      return local;
    }
    console.warn('Gemini curation unavailable, using on-device result:',e);
    showToast(e&&e.status===503?'AI checking is not set up here. Using on-device results.':'Couldn’t reach AI checking. Using on-device results.','info');
    return local;
  }
}
async function setCuration(on){
  if(on){
    const ok=await confirmDialog('Enable optional AI checking?\n\nBefore each request, you will see the exact result text, age and sex to be sent. Automatic redaction can miss identifying details, so check the preview carefully. You can choose on-device results instead.');
    if(!ok){const el=$('curateToggle');if(el)el.checked=false;return}
  }
  LS.set(CURATE_KEY,!!on);
}
function showLastCuration(){
  const c=window.__lastCuration;
  if(!c)return showToast('Nothing has been sent for AI checking yet','info');
  const st=c.stats,rm=Object.entries(st).filter(([,v])=>v).map(([k,v])=>`${v} ${k}`).join(', ')||'nothing needed removing';
  $('curationPreviewMeta').textContent=`Age ${c.sent.age??'not shared'} · Sex ${c.sent.sex??'not shared'} · Removed: ${rm}`;
  $('curationPreviewText').textContent=c.sent.text;
  $('curationPreview').showModal();
}
async function analyzeReport(){
  if(!uploadedFiles.length)return showToast('Add at least one file first','error');
  const blocked=blockingImageFiles();
  if(blocked.length)return showToast(`Retake ${blocked.length} photo${blocked.length===1?'':'s'} or choose Use anyway before analysis`,'error');
  window.__aiOcrUsed=false;
  $('resultsSection').classList.remove('active');
  $('historySection').style.display='none';
  $('analyzeSection').style.display='none';
  $('progressSection').classList.add('active');

  const N=uploadedFiles.length;
  const overview=$('multiOverview');
  if(overview){
    overview.style.display=N>1?'block':'none';
    overview.innerHTML=`<div class="mo-head">Analyzing <strong>${N}</strong> reports</div><div class="mo-list">`+
      uploadedFiles.map((f,i)=>`<div class="mo-row" id="moRow-${i}">
        <span class="mo-ic"><svg class="icn" aria-hidden="true" focusable="false"><use href="#i-history"/></svg></span>
        <span class="mo-name" title="${esc(f.name)}">${esc(f.name)}</span>
        <span class="mo-status" id="moStatus-${i}">queued</span>
      </div>`).join('')+`</div>`;
  }
  const setRow=(i,ic,txt,cls)=>{
    const row=$('moRow-'+i); if(!row)return;
    const icEl=row.querySelector('.mo-ic'), stEl=$('moStatus-'+i);
    if(icEl)icEl.innerHTML=ic;
    if(stEl)stEl.textContent=txt;
    row.classList.remove('done','err','busy'); if(cls)row.classList.add(cls);
  };

  try{
    if(groupMode==='separate'||N===1){
      const created=[];
      const rejectedFiles=[];
      let last=null;

      for(let i=0;i<N;i++){
        const f=uploadedFiles[i];
        setRow(i,'<svg class="icn" aria-hidden="true" focusable="false"><use href="#i-history"/></svg>','reading…','busy');
        setProgress(i/N,`Reading file ${i+1} of ${N}`,f.name);
        try{
          const text=await readFileText(f);
          const dGuess=extractReportDate(text,f.name);
          const metrics=await extractMetrics(text,f.name,dGuess);
          const scanImages=f.imageDataURL?[{name:f.name,dataURL:f.imageDataURL,tags:[]}]:[];
          const docPages=f.docPages||[];
          const sourceMode=(f.type==='image'||f.ocrPages>0)?'ocr':'digital';
          let a=attachAnalysisAudit(buildAnalysis(metrics,f.name,text,uploadCategory,{scanImages,docPages,ocrLines:f.ocrLines,sourceMode}),1,0,0);

          // Strict Lab-Only Guard Rail Check:
          // A valid report MUST be detected as 'lab' and carry at least 1 numeric lab metric!
          const isValidLabReport = a.category==='lab' && metrics.length >= 1;

          if(!isValidLabReport){
            rejectedFiles.push({
              name: f.name,
              reason: metrics.length === 0 ? 'No numeric lab metrics identified' : 'Non-lab document type',
              kind:'unsupported'
            });
            setRow(i,'<svg class="icn" aria-hidden="true" focusable="false"><use href="#i-x"/></svg>','rejected','err');
          } else {
            const idResult=await checkIdentityForAnalysis(a);
            if(idResult&&idResult.action==='continue-newuser'){
              const d2=extractReportDate(text,f.name);
              const metrics2=await extractMetrics(text,f.name,d2);
              a=attachAnalysisAudit(buildAnalysis(metrics2,f.name,text,uploadCategory,{scanImages,docPages,ocrLines:f.ocrLines,sourceMode}),1,0,0);
            }
            const savedA=await saveAnalysis(a);
            created.push(savedA); last=savedA;
            setRow(i,'<svg class="icn" aria-hidden="true" focusable="false"><use href="#i-check"/></svg>', `${catMeta(savedA.category).label} · ${savedA.totalMetrics||0} values`,'done');
          }
        }catch(err){
          console.error('file failed:',f.name,err);
          rejectedFiles.push({
            name: f.name,
            reason: (err && err.message) ? err.message : String(err || 'Unreadable document format or scanning error'),
            kind:'processing'
          });
          setRow(i,'<svg class="icn" aria-hidden="true" focusable="false"><use href="#i-x"/></svg>', 'rejected','err');
        }
        setProgress((i+1)/N,`Analyzed ${i+1} of ${N}`,f.name);
      }

      const closeOverview=()=>{if(overview){overview.style.display='none';overview.innerHTML=''}};
      setTimeout(closeOverview,1200);
      setProgress(1,'Analysis complete','');
      $('progressSection').classList.remove('active');

      if(created.length){
        const totalVals=created.reduce((n,r)=>n+(r.totalMetrics||0),0);
        if(N>1){
          displayResults(last);
          showToast(`${created.length} lab report(s) saved`,'success');
        }else{
          displayResults(created[0]);
          showToast(totalVals?`Found ${totalVals} lab parameters`:'Analysis complete','info');
        }
      }

      // Enforce the Lab-Only Rejection Policy Guard Rail
      if(rejectedFiles.length){
        showRejectionModal(rejectedFiles);
      }
    } else {
      // Explicit merge pipeline (Guarded by lab-only check)
      let all='';
      for(let i=0;i<N;i++){
        const f=uploadedFiles[i];
        setRow(i,'<svg class="icn" aria-hidden="true" focusable="false"><use href="#i-history"/></svg>','reading…','busy');
        setProgress(i/N,`Reading file ${i+1} of ${N}`,f.name);
        try{ all+=await readFileText(f)+'\n'; setRow(i,'<svg class="icn" aria-hidden="true" focusable="false"><use href="#i-check"/></svg>','read','done'); }
        catch(e){ setRow(i,'<svg class="icn" aria-hidden="true" focusable="false"><use href="#i-alert"/></svg>','could not read','err'); }
      }
      const closeOverview=()=>{if(overview){overview.style.display='none';overview.innerHTML=''}};
      setTimeout(closeOverview,1200);
      setProgress(1,'Analysis complete','');
      $('progressSection').classList.remove('active');

      if(all.trim()){
        const dGuess=extractReportDate(all,'merged_report');
        const metrics=await extractMetrics(all,'merged_report',dGuess);
        const scanImages=[];
        for(const f of uploadedFiles){
          if(f.imageDataURL)scanImages.push({name:f.name,dataURL:f.imageDataURL,tags:[]});
        }
        const sourceMode=uploadedFiles.some(f=>f.type==='image'||f.ocrPages>0)?'ocr':'digital';
        let a=attachAnalysisAudit(buildAnalysis(metrics,`Merged ${N} files`,all,uploadCategory,{scanImages,ocrLines:uploadedFiles.flatMap(f=>f.ocrLines||[]),sourceMode}),1,0,0);

        const isValidLabReport = a.category==='lab' && metrics.length >= 1;

        if(!isValidLabReport){
          showRejectionModal([{name: `Merged ${N} files`, reason: metrics.length === 0 ? 'No numeric lab metrics identified' : 'Non-lab document type'}]);
        } else {
          const idResult=await checkIdentityForAnalysis(a);
          if(idResult&&idResult.action==='continue-newuser'){
            const d2=extractReportDate(all,'merged_report');
            const metrics2=await extractMetrics(all,'merged_report',d2);
            a=attachAnalysisAudit(buildAnalysis(metrics2,`Merged ${N} files`,all,uploadCategory,{scanImages,ocrLines:uploadedFiles.flatMap(f=>f.ocrLines||[]),sourceMode}),1,0,0);
          }
          const savedA=await saveAnalysis(a);
          displayResults(savedA);
          showToast(`Files successfully merged into 1 report`,'success');
        }
      }else{
        $('analyzeSection').style.display='block';
        showToast('None of the files could be read. Try clearer scans or PDFs.','error');
      }
    }
  }catch(e){
    console.error('analysis failed:',e);
    $('progressSection').classList.remove('active');
    $('analyzeSection').style.display='block';
    showToast('Analysis failed: '+(e&&e.message||'unknown error'),'error');
  }
}

function showRejectionModal(files){
  const previous=document.getElementById('rejectionModal');
  if(previous)previous.remove();
  const processingFailure=files.length>0&&files.every(f=>f.kind==='processing');
  const overlay=document.createElement('div');
  overlay.className='modal-overlay active';
  overlay.id='rejectionModal';
  overlay.style.zIndex='9999';

  const modal=document.createElement('div');
  modal.className='modal';
  modal.style.maxWidth='480px';
  modal.style.padding='24px';
  modal.style.borderRadius='var(--radius)';
  modal.style.background='var(--bg)';
  modal.style.border='1px solid var(--border)';
  modal.style.boxShadow='var(--shadow-lg)';

  modal.innerHTML=processingFailure?`
    <h3 style="margin-top:0;display:flex;align-items:center;gap:8px;font-size:15px;font-weight:900;color:var(--danger)">Couldn’t read this report</h3>
    <p style="font-size:12px;color:var(--text-secondary);margin-bottom:12px;line-height:1.5">
      The file was not classified as unsupported. The on-device PDF/OCR reader failed before LabLens could check its contents.
    </p>
    <div style="background:var(--card);border:1px solid var(--border);border-radius:var(--radius-sm);padding:8px 12px;margin-bottom:14px;max-height:100px;overflow-y:auto;font-size:12.5px;color:var(--text)">
      ${files.map(f=>`<div style="margin-bottom:4px"><strong>${esc(f.name)}</strong>: <span style="color:var(--danger)">${esc(f.reason)}</span></div>`).join('')}
    </div>
    <div style="font-size:12px;color:var(--text);background:rgba(209,88,74,0.06);border:1px solid rgba(209,88,74,0.22);border-radius:10px;padding:12px;margin-bottom:16px;line-height:1.5">
      <strong>No report was saved.</strong> Refresh once to load the latest offline reader, then retry. If it still fails, reopen LabLens while online so the local PDF assets can be refreshed.
    </div>
    <div class="modal-actions" style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px;flex-wrap:wrap">
      <button class="btn-secondary" id="btnRejectionClose" style="padding:8px 16px;font-size:12px">Close</button>
      <button class="btn-primary" id="btnRejectionRetry" style="padding:8px 16px;font-size:12px">Try again</button>
    </div>
  `:`
    <h3 style="margin-top:0;display:flex;align-items:center;gap:8px;font-size:15px;font-weight:900;color:var(--danger)">Upload not supported</h3>
    <p style="font-size:12px;color:var(--text-secondary);margin-bottom:12px;line-height:1.5">
      LabLens could read the file, but could not identify a supported numeric lab report:
    </p>
    <div style="background:var(--card);border:1px solid var(--border);border-radius:var(--radius-sm);padding:8px 12px;margin-bottom:14px;max-height:100px;overflow-y:auto;font-size:12.5px;color:var(--text)">
      ${files.map(f=>`<div style="margin-bottom:4px"><strong>${esc(f.name)}</strong>: <span style="color:var(--danger)">${esc(f.reason)}</span></div>`).join('')}
    </div>
    <div style="font-size:12px;color:var(--text);background:rgba(209,88,74,0.06);border:1px solid rgba(209,88,74,0.22);border-radius:10px;padding:12px;margin-bottom:16px;line-height:1.5">
      <div style="font-weight:900;color:var(--danger);margin-bottom:6px">LabLens rejection policy:</div>
      <div style="margin-bottom:6px">This specialized version of LabLens is optimized <strong>exclusively</strong> for numeric clinical lab reports. To preserve your database's integrity, we do not accept or save non-lab reports.</div>
      <div style="font-weight:700;margin-top:10px">Not Supported in This Build:</div>
      <div style="color:var(--text-secondary);margin-left:8px">• X-Rays, Ultrasounds, CTs, MRIs (Diagnostic Scans)</div>
      <div style="color:var(--text-secondary);margin-left:8px">• Eyeglass Spectacle Prescriptions (SPH/CYL/AXIS)</div>
      <div style="color:var(--text-secondary);margin-left:8px">• Hospital discharge summaries, vaccination cards, or clinic notes</div>
    </div>

    <p style="font-size:12.5px;color:var(--text-secondary);margin-bottom:16px;line-height:1.4">
      <strong>What you can upload:</strong> Please upload digital PDFs or clear photos of standard lab panels (such as Complete Blood Counts (CBC), Lipid profiles, Glucose/HbA1c, Thyroid, Liver, Kidney, or Urinalysis).
    </p>

    <div class="modal-actions" style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">
      <button class="btn-primary" id="btnRejectionClose" style="padding:8px 16px;font-size:12px">Close</button>
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  overlay.querySelector('#btnRejectionClose').addEventListener('click', ()=>{
    overlay.remove();
    $('analyzeSection').style.display='block';
  });
  const retry=overlay.querySelector('#btnRejectionRetry');
  if(retry)retry.addEventListener('click',()=>{overlay.remove();$('analyzeSection').style.display='block';analyzeReport();});
}
function displayResults(a){currentAnalysis=a;LS.set('currentAnalysisId_'+(currentUser||'guest'),a?String(a.id):null);const cat=catMeta(a.category);$('resultDate').textContent='Report date: '+fmtDate(a.date)+(a.analyzedAt?' · analyzed '+fmtDate(a.analyzedAt,{month:'short',day:'numeric',year:'numeric'}):'')+' · '+(a.fileName||'Health Report');$('resultHeader').classList.toggle('warn',(a.outOfRangeCount||0)>0);$('reportTypeBar').innerHTML=`<span style="font-size:12px;color:var(--text-secondary);font-weight:800">Report type</span><strong>${cat.icon} ${esc(cat.label)}</strong><select class="cat-select" onchange="changeReportCategory(this.value)">${CATS.map(c=>`<option value="${c.key}" ${c.key===a.category?'selected':''}>${c.icon} ${esc(c.label)}</option>`).join('')}</select>`;renderNav();setActiveNav('current');const det = a.detectedPatient || {};
  let patientHtml = '';
  if (det.name || det.age != null || det.sex) {
    patientHtml = `
      <div class="patient-card" style="background:var(--card);border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px 16px;margin-bottom:16px;display:flex;align-items:center;gap:18px;flex-wrap:wrap;font-size:12.5px;color:var(--text);box-shadow:var(--shadow)">
        <div style="font-weight:900;color:var(--primary);display:flex;align-items:center;gap:6px">Patient profile:</div>
        ${det.name ? `<div>Name: <strong>${esc(det.name)}</strong></div>` : ''}
        ${det.age != null ? `<div>Age: <strong>${det.age} yrs</strong></div>` : ''}
        ${det.sex ? `<div>Sex: <strong>${esc(det.sex.toUpperCase())}</strong></div>` : ''}
      </div>
    `;
  }
  $('demoNote').innerHTML='';
metricsFilter=null; // a freshly displayed report never inherits a stale filter
renderVerificationCard(a);
const _tiers={'tier-concern':0,'tier-borderline':0,'tier-safe':0,'tier-unknown':0};(a.metrics||[]).forEach(m=>{_tiers[severityTier(m)]++});const total=(a.metrics||[]).length,outOfRange=_tiers['tier-concern'],safe=_tiers['tier-safe'],concern=_tiers['tier-concern'],borderline=_tiers['tier-borderline'],unscored=_tiers['tier-unknown'];const ok=outOfRange===0;const statKey=(filter)=>`if(event.key==='Enter'||event.key===' '){event.preventDefault();setMetricsFilter(${filter})}`;$('healthStatusDisplay').innerHTML=`<div class="status-row"><div class="status-icon ${ok?'good':'attention'}">${ok?'<svg class="icn" aria-hidden="true" focusable="false"><use href="#i-check"/></svg>':'<svg class="icn" aria-hidden="true" focusable="false"><use href="#i-alert"/></svg>'}</div><div><h4>${ok?'No recognized values outside range':'Review out-of-range values'}</h4><p style="color:var(--text-secondary);font-size:12px;margin-top:4px">${ok?'This describes extracted values only; it is not a diagnosis.':`${outOfRange} of ${total} extracted values are outside the reference range.`}</p></div></div><div class="stat-grid"><button type="button" aria-label="Show all ${total} values" class="stat-box" onclick="setMetricsFilter(null)"><span class="v">${total}</span><span class="l">Total</span></button><button type="button" aria-label="Show ${concern} values outside the range" class="stat-box tone-concern" onclick="setMetricsFilter('tier-concern')"><span class="v">${concern}</span><span class="l">Outside range</span></button><button type="button" aria-label="Show ${borderline} values near the edge of the range" class="stat-box tone-borderline" onclick="setMetricsFilter('tier-borderline')"><span class="v">${borderline}</span><span class="l">Near the edge</span></button><button type="button" aria-label="Show ${safe} values in range" class="stat-box tone-safe" onclick="setMetricsFilter('tier-safe')"><span class="v">${safe}</span><span class="l">In range</span></button>${unscored?`<button type="button" aria-label="Show ${unscored} values without a range to compare" class="stat-box tone-unknown" onclick="setMetricsFilter('tier-unknown')"><span class="v">${unscored}</span><span class="l">No range</span></button>`:''}</div>`;
renderAIReviewCard(a);renderTagsNotes(a);
renderQuickMetricsSummary(a);
renderMetricsList(a);
renderDocumentView(a);
  const hasMeds=(a.medDrafts&&a.medDrafts.length)||a.category==='prescription';
  const mt=$('tabMeds'); if(mt)mt.style.display=hasMeds?'':'none';
  const mdl=$('medDraftList'); if(mdl)mdl.innerHTML=hasMeds?renderMedDrafts(a):'';
  renderUpcoming();$('recommendationsList').innerHTML=(a.recommendations||[]).map(r=>`<div class="rec-card"><div class="rec-icon"><svg class="icn" aria-hidden="true" focusable="false"><use href="#i-info"/></svg></div><div class="rec-text"><h5>${esc(r.title)}</h5><p>${esc(r.desc)}</p></div></div>`).join('');displayComparison();$('resultsSection').classList.add('active');$('uploadSection').style.display='none';$('historySection').style.display='none';switchTab(activeResultTab||'summary');setTimeout(()=>$('resultsSection').scrollIntoView({behavior:'smooth',block:'start'}),80)}

function renderAIReviewCard(a){
  const el=$('aiReviewCard'); if(!el)return;
  const hasData=(Array.isArray(a.metrics)&&a.metrics.length)||a.rawText;
  if(!hasData){el.innerHTML='';return;}
  el.innerHTML=`<div class="ai-review-card"><h5>Ask AI about this report</h5><p>Chat in the app. Shares only test values, ranges and earlier results of the same tests, never your name, age, dates or file name.</p><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn-primary" onclick="openAskAI(null)">Ask AI</button></div></div>`;
}

function renderVerificationCard(a){
  const el=$('verificationCard');if(!el)return;
  const v=refreshVerification(a),pending=v.pendingCount;
  if(!pending){el.innerHTML='';return}
  el.innerHTML=`<div class="verification-card"><div class="verification-copy"><div class="verification-icon"><svg class="icn" aria-hidden="true" focusable="false"><use href="#i-alert"/></svg></div><div><div class="verification-title">${pending} of ${v.totalCount} values to double-check</div></div></div><button class="verification-action" onclick="setMetricsFilter('review')">Review</button></div>`;
}


function toggleProv(i){const el=$('prov-'+i);if(el)el.classList.toggle('open');paintSourceCrops($('prov-'+i))}
// Let the user tell us a value is wrong. The parser will never be perfect, and a
// silent wrong number is the most dangerous thing this app can produce — so we make
// it one tap to mark it, and we stop trusting it immediately.
async function flagMetric(i){
  if(!currentAnalysis||!currentAnalysis.metrics[i])return;
  const m=currentAnalysis.metrics[i];
  if(!await confirmDialog(`Mark "${m.name} = ${metricValueText(m)}" as misread?\n\nIt will be excluded from your summary and trends until you re-check it.`))return;
  m.flaggedWrong=true; m.status='unknown'; m.excluded=true;
  currentAnalysis.metrics=currentAnalysis.metrics.filter(x=>!x.excluded||x===m);
  // recompute the counts so a value the user distrusts stops driving the summary
  const live=currentAnalysis.metrics.filter(x=>!x.flaggedWrong);
  currentAnalysis.totalMetrics=live.length;
  currentAnalysis.highCount=live.filter(x=>x.status==='high').length;
  currentAnalysis.lowCount=live.filter(x=>x.status==='low').length;
  currentAnalysis.normalCount=live.filter(x=>x.status==='normal').length;
  currentAnalysis.outOfRangeCount=currentAnalysis.highCount+currentAnalysis.lowCount;
  currentAnalysis.safeCount=live.filter(x=>severityTier(x)==='tier-safe').length;
  currentAnalysis.borderlineCount=live.filter(x=>severityTier(x)==='tier-borderline').length;
  currentAnalysis.concernCount=live.filter(x=>severityTier(x)==='tier-concern').length;
  if(currentAnalysis.category==='lab'){
    currentAnalysis.laymanSummary=layman(live,live.filter(x=>x.status==='high'),live.filter(x=>x.status==='low'));
    currentAnalysis.recommendations=recommendations(live.filter(x=>x.status==='high'),live.filter(x=>x.status==='low'));
  }
  persistCurrent();
  displayResults(currentAnalysis);
  showToast('Marked as misread — excluded from your summary and trends','info');
  // Close the loop: a misread value is exactly the signal the parser library
  // needs to improve, but flagging it above is purely local -- nothing about
  // it ever reaches support unless the user separately files feedback. Offer
  // to report it now, pre-filled with only the parsed name/value and the exact
  // source line it was read from (no patient name, age, or file name).
  if(await confirmDialog(`Send this misread to LabLens support so it can be fixed?\n\nOnly the test name, the value we read, and the exact line from your report are included — never your name, age, or file name.`)){
    const report=[
      `Parsing issue: a value was misread.`,
      `Report type: ${(currentAnalysis.category||'lab')}`,
      `Parsed as: ${m.name} = ${metricValueText(m)} ${m.unit||''}`.trim(),
      `Read from this line: "${m.srcLine||'(not available)'}"`,
      ``,
      `(Add any extra context below)`
    ].join('\n');
    openFeedbackModal(report);
  }
}

// §6: Metric Detail View -- reachable from a tap in Browse mode (raw report or a
// filtered list), a lasso in Select mode, or a tap on any metric card / summary
// item. Shows the hero value, where it sits in its range, its trend over past
// reports, provenance, and a scoped AI chat entry -- never the raw report text.
let metricSheetKeys=[];
let metricSheetActiveKey=null;
function metricByKey(k){ return (currentAnalysis&&currentAnalysis.metrics||[]).find(x=>x.key===k); }
function openMetricSheet(keyOrKeys){
  const keys=(Array.isArray(keyOrKeys)?keyOrKeys:[keyOrKeys]).filter(k=>metricByKey(k));
  if(!keys.length)return;
  metricSheetKeys=keys; metricSheetActiveKey=keys[0];
  renderMetricSheet();
  $('metricSheetOverlay').classList.add('active');
}
function closeMetricSheet(){ $('metricSheetOverlay').classList.remove('active'); }
function metricSheetPick(k){ metricSheetActiveKey=k; renderMetricSheet(); }
function metricSparklineSVG(key){
  const series=trendSeriesFor(key).filter(s=>isFinite(s.value));
  if(series.length<2)return '';
  const vals=series.map(s=>s.value);
  const lo=Math.min(...vals), hi=Math.max(...vals);
  const w=260,h=54,pad=8;
  const pts=vals.map((v,i)=>{
    const x=pad+(vals.length>1?(i/(vals.length-1)):0.5)*(w-2*pad);
    const y=h-pad-((hi>lo)?((v-lo)/(hi-lo)):0.5)*(h-2*pad);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return `<div class="metric-spark"><div class="metric-spark-label">Trend across ${series.length} report${series.length===1?'':'s'}</div>
    <svg viewBox="0 0 ${w} ${h}" class="spark-svg" preserveAspectRatio="none">
      <polyline points="${pts.join(' ')}" fill="none" stroke="var(--primary)" stroke-width="2.2"/>
      ${pts.map(p=>`<circle cx="${p.split(',')[0]}" cy="${p.split(',')[1]}" r="2.6" fill="var(--primary)"/>`).join('')}
    </svg></div>`;
}
/* ============== SOURCE CROP ==============
   Shows the exact strip of the original page a value was read from, with the
   value's box outlined, so the reading can be checked without leaving the value. */
function sourceCropHTML(m){
  if(!m||!m.bbox||m.bboxPage==null||!currentAnalysis||!(currentAnalysis.docPages||[])[m.bboxPage])return '';
  return `<figure class="src-crop" data-crop-key="${esc(m.key)}"><canvas role="img" aria-label="Original report line for ${esc(m.name)}"></canvas><figcaption>Cropped from your original report. The outlined value is what we read.</figcaption></figure>`;
}
function paintSourceCrops(root){
  (root||document).querySelectorAll('figure.src-crop').forEach(fig=>{
    if(fig.dataset.painted)return;
    const m=metricByKey(fig.dataset.cropKey),page=m&&(currentAnalysis.docPages||[])[m.bboxPage];
    if(!m||!page||!page.image){fig.hidden=true;return}
    const img=new Image();
    img.onload=()=>{
      try{
        const W=img.naturalWidth,H=img.naturalHeight,b=m.bbox;
        const padX=0.02,padY=Math.max(0.012,(b.y1-b.y0)*1.1);
        const x0=Math.max(0,b.x0-padX),x1=Math.min(1,b.x1+padX),y0=Math.max(0,b.y0-padY),y1=Math.min(1,b.y1+padY);
        const sx=x0*W,sw=Math.max(40,(x1-x0)*W),sy=y0*H,sh=Math.max(24,(y1-y0)*H);
        const cv=fig.querySelector('canvas'),scale=Math.min(2.2,720/sw);
        cv.width=Math.round(sw*scale);cv.height=Math.round(sh*scale);
        const g=cv.getContext('2d');g.imageSmoothingQuality='high';g.drawImage(img,sx,sy,sw,sh,0,0,cv.width,cv.height);
        // Outline only the value, a few pixels outside its glyphs, with a light multiply tint
        // so the digits stay fully legible underneath.
        const vb=m.valBox||b,pad=5*Math.max(1,scale/1.4);
        const rx=(vb.x0*W-sx)*scale-pad,ry=(vb.y0*H-sy)*scale-pad*0.8,rw=(vb.x1-vb.x0)*W*scale+pad*2,rh=(vb.y1-vb.y0)*H*scale+pad*1.6;
        const path=()=>{g.beginPath();if(g.roundRect)g.roundRect(rx,ry,rw,rh,5);else g.rect(rx,ry,rw,rh)};
        g.save();g.globalCompositeOperation='multiply';g.fillStyle='rgba(44,118,80,0.20)';path();g.fill();g.restore();
        g.lineWidth=2;g.strokeStyle='#2C7650';path();g.stroke();
        fig.dataset.painted='1';
      }catch(e){fig.hidden=true}
    };
    img.onerror=()=>{fig.hidden=true};
    img.src=page.image;
  });
}
/* Reference-range scale drawn to true proportion. The axis extends past the reference limits
   so a value outside the range sits outside the green band at its real position, and a value
   inside the range sits where it falls between the limits. */
function metricRangeBar(m,tier){
  const v=+m.value,hasMin=isFinite(m.min),hasMax=isFinite(m.max);
  if(!isFinite(v)||(!hasMin&&!hasMax))return '';
  const width=hasMin&&hasMax?(m.max-m.min):Math.max(Math.abs(hasMax?m.max:m.min),1);
  const pad=width*0.35;
  let lo=hasMin?m.min-pad:Math.min(0,v-pad),hi=hasMax?m.max+pad:v+pad+width*0.5;
  if(hasMin&&lo<0&&m.min>=0&&v>=0)lo=Math.max(0,lo);        // a count cannot go below zero
  lo=Math.min(lo,v-width*0.08);hi=Math.max(hi,v+width*0.08);
  {const e=(hi-lo)*0.05;hi+=e;if(!(hasMin&&m.min>=0&&v>=0&&lo<=0))lo-=e}   // headroom so the dot is never clipped
  const span=hi-lo||1,pos=x=>Math.max(0,Math.min(100,(x-lo)/span*100));
  const g0=hasMin?pos(m.min):0,g1=hasMax?pos(m.max):100;
  const color=trendTierColor(tier),vp=pos(v);
  const fmt=x=>fmtTick(+(+x).toPrecision(4));
  const tick=(x,label)=>`<span class="rb-tick" style="left:${pos(x)}%"><i></i>${label}</span>`;
  const ticks=(hasMin?tick(m.min,fmt(m.min)):'')+(hasMax?tick(m.max,fmt(m.max)):'');
  const status=tier==='tier-concern'?(m.status==='low'?'Below the reference range':'Above the reference range'):tier==='tier-borderline'?'Inside the range, close to its edge':tier==='tier-safe'?'Inside the reference range':'';
  return `<div class="rb" role="img" aria-label="${esc(m.name)} ${esc(metricValueText(m))} ${esc(m.unit||'')}. ${status}. Reference range ${esc(m.normal_range||'')}.">
    <div class="rb-track"><div class="rb-ref" style="left:${g0}%;width:${Math.max(0,g1-g0)}%"></div><div class="rb-dot" style="left:${vp}%;--c:${color}"></div></div>
    <div class="rb-ticks">${ticks}</div>
    <div class="rb-caption">${esc(status)}${m.normal_range?` · reference ${esc(m.normal_range)}`:''}</div>
  </div>`;
}
function renderMetricSheet(){
  const body=$('metricSheetBody'); if(!body)return;
  const m=metricByKey(metricSheetActiveKey);
  if(!m){ body.innerHTML=`<div class="sheet-handle"></div><button aria-label="Close value details" class="ai-close sheet-close" onclick="closeMetricSheet()" aria-label="Close"><svg class="icn" aria-hidden="true" focusable="false"><use href="#i-x"/></svg></button><div class="empty-state"><div class="ic"><svg class="icn" aria-hidden="true" focusable="false"><use href="#i-file"/></svg></div><p>That value is no longer available.</p></div>`; return; }
  const tier=severityTier(m);
  const tierLabel={'tier-safe':'Normal','tier-borderline':'Borderline','tier-concern':'High/Low','tier-unknown':'Unknown'}[tier]||m.status;
  const chips=metricSheetKeys.length>1?`<div class="metric-chip-row">${metricSheetKeys.map(k=>{const mm=metricByKey(k);if(!mm)return '';return `<button class="chip ${k===metricSheetActiveKey?'active':''}" onclick="metricSheetPick('${k}')">${esc(mm.name)}</button>`;}).join('')}</div>`:'';
  const rangeBar=metricRangeBar(m,tier);
  body.innerHTML=`
    <div class="sheet-handle"></div>
    <button aria-label="Close value details" class="ai-close sheet-close" onclick="closeMetricSheet()" aria-label="Close"><svg class="icn" aria-hidden="true" focusable="false"><use href="#i-x"/></svg></button>
    ${chips}
    <div class="metric-hero">
      <div class="metric-hero-value tier-text-${tier}">${esc(metricValueText(m))}<span class="metric-hero-unit">${esc(m.unit||'')}</span></div>
      <div><span class="status-pill ${tier}">${esc(tierLabel)}</span></div>
      <div class="metric-hero-name">${esc(m.name)}</div>
    </div>
    ${rangeBar}
    ${metricSparklineSVG(m.key)}
    ${m.srcLine?`<div class="prov sheet-prov"><button class="prov-toggle" onclick="toggleSheetProv()">Where did this come from?</button><div class="prov-body ${sourceCropHTML(m)?'open':''}" id="sheetProvBody">${sourceCropHTML(m)}<div class="prov-label">Read from this line of your report:</div><code class="prov-line">${esc(m.srcLine)}</code><button class="prov-flag" onclick="flagMetricByKey('${m.key}')"><svg class="icn" aria-hidden="true" focusable="false"><use href="#i-flag"/></svg> This value is wrong</button></div></div>`:''}
    ${typeof m.value==='number'?'<button type="button" class="btn-secondary" onclick="renderMetricCorrection()">Correct this result</button>':''}
    <div style="display:flex;flex-direction:column;gap:8px;margin-top:4px">
      <button class="btn-primary sheet-ai-btn" onclick="explainMetricsNow([${metricSheetKeys.map(k=>`'${k}'`).join(',')}])">Ask AI about ${metricSheetKeys.length>1?'these values':'this value'}</button>

    </div>
  `;
  paintSourceCrops(body);
}
function renderMetricCorrection(){
  const m=metricByKey(metricSheetActiveKey),body=$('metricSheetBody');
  if(!m||!body||typeof m.value!=='number')return;
  body.innerHTML=`<div class="sheet-handle"></div><button type="button" class="ai-close sheet-close" aria-label="Back to result" onclick="renderMetricSheet()"><svg class="icn" aria-hidden="true"><use href="#i-x"/></svg></button><h3>Correct ${esc(m.name)}</h3><p class="fld-help">Check the original report before saving. The result and its unit will update this report and its trend.</p>${sourceCropHTML(m)}<p class="fld-help">Read from: <code>${esc(m.srcLine||'Source line unavailable')}</code></p><form onsubmit="saveMetricCorrection(event)"><label class="fld-label" for="correctValue">Result</label><input class="field" id="correctValue" type="number" step="any" required value="${esc(m.value)}"><label class="fld-label" for="correctQualifier">Comparison</label><select class="field" id="correctQualifier"><option value="" ${!m.qualifier?'selected':''}>Exact value</option><option value="<" ${m.qualifier==='<'?'selected':''}>Less than (&lt;)</option><option value=">" ${m.qualifier==='>'?'selected':''}>Greater than (&gt;)</option></select><label class="fld-label" for="correctUnit">Unit as printed</label><input class="field" id="correctUnit" type="text" maxlength="40" value="${esc(m.unit||'')}"><p class="fld-help">Reference range: ${esc(m.normal_range||'Not stated')}. Changing the unit removes this comparison until the range is checked.</p><div class="modal-actions"><button type="button" class="btn-secondary" onclick="renderMetricSheet()">Cancel</button><button type="submit" class="btn-primary">Save correction</button></div></form>`;
  paintSourceCrops(body);
  $('correctValue').focus();
}
function saveMetricCorrection(event){
  event.preventDefault();
  const m=metricByKey(metricSheetActiveKey);if(!m||!currentAnalysis)return;
  const value=Number($('correctValue').value),unit=$('correctUnit').value.trim(),qualifier=$('correctQualifier').value;
  if(!Number.isFinite(value)||Math.abs(value)>1e7||!unit&&m.unit){showToast('Enter a valid result and its printed unit.','error');return}
  const previous={...m},oldAnalysis={...currentAnalysis,metrics:currentAnalysis.metrics.map(x=>x===m?{...m}:x)};
  m.value=value;m.valueText='';m.qualifier=qualifier;m.unit=unit;m.flaggedWrong=false;m.excluded=false;m.verified=true;m.corrected=true;
  if(!comparableUnit(unit,previous.unit)){m.min=null;m.max=null;m.normal_range='Reference range needs review for this unit';m.refFromReport=false;m.status='unknown'}
  else m.status=statusForQualified(value,m.min,m.max,qualifier);
  const live=currentAnalysis.metrics.filter(x=>!x.flaggedWrong&&!x.excluded);
  const high=live.filter(x=>x.status==='high'),low=live.filter(x=>x.status==='low');
  currentAnalysis.totalMetrics=live.length;currentAnalysis.highCount=high.length;currentAnalysis.lowCount=low.length;currentAnalysis.normalCount=live.filter(x=>x.status==='normal').length;currentAnalysis.outOfRangeCount=high.length+low.length;
  currentAnalysis.safeCount=live.filter(x=>severityTier(x)==='tier-safe').length;currentAnalysis.borderlineCount=live.filter(x=>severityTier(x)==='tier-borderline').length;currentAnalysis.concernCount=live.filter(x=>severityTier(x)==='tier-concern').length;
  if(currentAnalysis.category==='lab'){currentAnalysis.laymanSummary=layman(live,high,low);currentAnalysis.recommendations=recommendations(high,low)}
  refreshVerification(currentAnalysis);
  const history=getHistory(),idx=history.findIndex(x=>String(x.id)===String(currentAnalysis.id));
  if(idx<0||!setHistory(history.map((r,i)=>i===idx?currentAnalysis:r))){Object.assign(m,previous);currentAnalysis=oldAnalysis;showToast('Correction was not saved. Check browser storage and try again.','error');return}
  closeMetricSheet();displayResults(currentAnalysis);showToast('Corrected result saved','success');
}

function highlightMetricOnDoc(key){
  const m=metricByKey(key);
  if(!m||m.bboxPage==null)return;
  // Switch to document tab
  switchTab('document');
  // Set doc mode to browse

  setTimeout(()=>{
    const pageEl=document.querySelector(`.doc-page[data-page="${m.bboxPage}"]`);
    if(pageEl){
      pageEl.scrollIntoView({behavior:'smooth',block:'center'});
      // Find the specific rect and add highlight class
      const rect=pageEl.querySelector(`rect[data-key="${key}"]`);
      if(rect){
        // Remove other highlights
        document.querySelectorAll('.doc-hit.highlight-active').forEach(r=>r.classList.remove('highlight-active'));
        rect.classList.add('highlight-active');
        // Auto-remove highlight after 5 seconds
        setTimeout(()=>{
          rect.classList.remove('highlight-active');
        },5000);
      }
    }
  },300);
}

function highlightMetricOnDoc(key){
  const m=metricByKey(key);
  if(!m||m.bboxPage==null)return;
  // Switch to document tab
  switchTab('document');
  // Set doc mode to browse

  setTimeout(()=>{
    const pageEl=document.querySelector(`.doc-page[data-page="${m.bboxPage}"]`);
    if(pageEl){
      pageEl.scrollIntoView({behavior:'smooth',block:'center'});
      // Find the specific rect and add highlight class
      const rect=pageEl.querySelector(`rect[data-key="${key}"]`);
      if(rect){
        // Remove other highlights
        document.querySelectorAll('.doc-hit.highlight-active').forEach(r=>r.classList.remove('highlight-active'));
        rect.classList.add('highlight-active');
        // Auto-remove highlight after 5 seconds
        setTimeout(()=>{
          rect.classList.remove('highlight-active');
        },5000);
      }
    }
  },300);
}
function toggleSheetProv(){ const el=$('sheetProvBody'); if(el)el.classList.toggle('open'); }
function flagMetricByKey(key){
  const idx=(currentAnalysis&&currentAnalysis.metrics||[]).findIndex(x=>x.key===key);
  closeMetricSheet();
  if(idx>-1)flagMetric(idx);
}
// Scoped AI chat: the assistant only ever receives already-labeled values (§1),
// and here we narrow that further to just the metric(s) the sheet was opened
// for -- reportContext() checks window.__aiScopedMetricKeys and filters to it.


// buildExplainPrompt — the single 3-part structured prompt used by ALL three
// entry points (single metric tap, lasso select, filter explain-all).
// It always asks: what is it · where do I stand · what should I do next.
// For multiple metrics the AI walks through each in sequence under its own ### header.
function buildExplainPrompt(keys){
  const ms=(currentAnalysis&&currentAnalysis.metrics||[]).filter(m=>keys.includes(m.key)&&!m.flaggedWrong);
  if(!ms.length)return null;
  if(ms.length===1){
    const m=ms[0];
    const tier=severityTier(m);
    const standDesc={
      'tier-safe':'sitting comfortably within the normal reference range',
      'tier-borderline':'sitting close to the boundary of the normal range — not quite outside it, but worth watching',
      'tier-concern':m.status==='high'?'above the normal reference range':'below the normal reference range',
      'tier-unknown':'showing no reference range in this report, so I cannot compare it to a standard'
    }[tier]||'flagged';
    return `I'd like you to explain **${m.name}** from my report using this exact 3-part structure:\n\n`+
      `**1. What is it?** — Explain in plain, friendly language what ${m.name} measures and why it matters. What organ or body system is involved? What does this marker tell a doctor?\n\n`+
      `**2. Where do I stand?** — My result is **${metricValueText(m)} ${m.unit||''}**. The reference range for this report is **${m.normal_range||'not stated'}**. My value is ${standDesc}. `+
      (isFinite(m.min)&&isFinite(m.max)?`To give me a sense of scale: the normal band runs from ${m.min} to ${m.max}. `:'')+'Tell me clearly — is this a little off or a lot? Should I be worried?\n\n'+
      `**3. What should I do next?** — Given where my ${m.name} sits, what are 2–3 practical, realistic things I can do? These could be lifestyle changes, things to discuss with my doctor, or just reassurance if everything looks fine. Be specific and actionable, not generic.`;
  }
  // Multiple metrics
  const intro=ms.length<=3
    ?`I'd like you to explain each of these ${ms.length} values from my report.`
    :`I'd like you to walk me through all ${ms.length} of these values from my report.`;
  const perMetric=ms.map(m=>{
    const tier=severityTier(m);
    const standDesc={
      'tier-safe':'within the normal range',
      'tier-borderline':'borderline — close to the edge of normal',
      'tier-concern':m.status==='high'?'above the normal range':'below the normal range',
      'tier-unknown':'no reference range available for comparison'
    }[tier]||'flagged';
    return `- **${m.name}**: my result is ${metricValueText(m)} ${m.unit||''} (reference: ${m.normal_range||'not stated'}) — ${standDesc}`;
  }).join('\n');
  return `${intro}\n\nFor each one, please cover:\n1. What it measures and why it matters (in plain language)\n2. Where my result stands and whether I should be concerned\n3. One or two practical next steps\n\nUse a **### header for each parameter** so I can scan the response easily.\n\nHere are the values:\n${perMetric}`;
}

// Entry point shared by all three triggers: sets scope, injects the structured
// prompt as if the user typed it, opens the AI chat, and fires immediately.
function explainMetricsNow(keys){
  if(!keys||!keys.length)return;
  closeMetricSheet();
  openAskAI(keys);
}

function renderTagsNotes(a){if(!Array.isArray(a.tags))a.tags=[];$('tagsNotesCard').innerHTML=`<div style="font-weight:900;margin-bottom:10px">Tags &amp; notes</div><div class="tag-row">${a.tags.map((t,i)=>`<span class="tag">${esc(t)} <span class="x" onclick="removeTag(${i})" role="button" aria-label="Remove tag"><svg class="icn" aria-hidden="true" focusable="false"><use href="#i-x"/></svg></span></span>`).join('')}<input class="tag-input" id="tagInput" placeholder="+ tag, Enter" onkeydown="if(event.key==='Enter'){event.preventDefault();addTagFromInput()}"></div><textarea class="note-area" id="noteArea" placeholder="Add personal notes…" oninput="onNoteInput(this.value)">${esc(a.note||'')}</textarea>`}
function persistCurrent(){if(!currentAnalysis)return;const h=getHistory();const i=h.findIndex(x=>String(x.id)===String(currentAnalysis.id));if(i>=0)h[i]=currentAnalysis;setHistory(h)}function addTagFromInput(){const inp=$('tagInput');if(!inp||!inp.value.trim())return;if(!currentAnalysis.tags)currentAnalysis.tags=[];currentAnalysis.tags.push(inp.value.trim().slice(0,30));persistCurrent();renderTagsNotes(currentAnalysis)}function removeTag(i){currentAnalysis.tags.splice(i,1);persistCurrent();renderTagsNotes(currentAnalysis)}function onNoteInput(v){currentAnalysis.note=v;persistCurrent()}


const medViewers={};
function initMedViewer(i){
  const scans=window.__medicalViewerImages||[], im=scans[i], canvas=$('medCanvas-'+i), stage=$('medStage-'+i);
  if(!im||!canvas||!stage)return;
  const v=medViewers[i]={img:new Image(),scale:1,fit:1,ox:0,oy:0,rot:0,invert:false,
                         bright:0,contrast:100,drag:false,lx:0,ly:0,src:null,dirty:true};
  v.img.onload=()=>{
    // Offscreen buffer at native image resolution holds the tone-adjusted pixels.
    v.src=document.createElement('canvas');
    v.src.width=v.img.width; v.src.height=v.img.height;
    const w=stage.clientWidth||640,h=stage.clientHeight||360;
    canvas.width=w;canvas.height=h;
    v.fit=Math.min(w/v.img.width,h/v.img.height);
    v.scale=v.fit;v.ox=0;v.oy=0;v.dirty=true;
    medRedraw(i);
  };
  v.img.onerror=()=>console.warn('Medical image failed to load');
  v.img.src=im.dataURL;
  stage.onpointerdown=e=>{v.drag=true;v.lx=e.clientX;v.ly=e.clientY;try{stage.setPointerCapture(e.pointerId)}catch(_){}stage.focus()};
  stage.onpointermove=e=>{if(!v.drag)return;v.ox+=e.clientX-v.lx;v.oy+=e.clientY-v.ly;v.lx=e.clientX;v.ly=e.clientY;medRedraw(i)};
  stage.onpointerup=()=>{v.drag=false};
  stage.onpointercancel=()=>{v.drag=false};
  stage.onwheel=e=>{e.preventDefault();medZoom(i,e.deltaY<0?1.12:0.88)};
  stage.onkeydown=e=>{if(e.key==='+'||e.key==='=')medZoom(i,1.15);else if(e.key==='-'||e.key==='_')medZoom(i,.87);else if(e.key==='0')medReset(i)};
}
// Apply brightness / contrast / invert directly to pixels. This is done on an
// offscreen buffer (only when a control changes), so it works in every browser —
// ctx.filter is unreliable across canvas implementations.
function medBuildSource(i){
  const v=medViewers[i]; if(!v||!v.src||!v.img.width)return;
  const sx=v.src.getContext('2d',{willReadFrequently:true});
  sx.clearRect(0,0,v.src.width,v.src.height);
  sx.drawImage(v.img,0,0);
  const b=Number(v.bright)||0;              // -100 .. 100
  const c=(Number(v.contrast)||100)/100;    // 0.5 .. 2.0
  const inv=!!v.invert;
  if(b===0 && c===1 && !inv){ v.dirty=false; return; }   // nothing to do
  const d=sx.getImageData(0,0,v.src.width,v.src.height);
  const px=d.data;
  // Precompute a 256-entry lookup table -> fast even for large X-rays.
  const lut=new Uint8ClampedArray(256);
  for(let k=0;k<256;k++){
    let val=k + (b*255/100);                 // brightness shift
    val=((val-128)*c)+128;                   // contrast around mid-grey
    if(inv)val=255-val;                      // invert
    lut[k]=val<0?0:val>255?255:val;
  }
  for(let p=0;p<px.length;p+=4){
    px[p]=lut[px[p]]; px[p+1]=lut[px[p+1]]; px[p+2]=lut[px[p+2]];
  }
  sx.putImageData(d,0,0);
  v.dirty=false;
}
function medRedraw(i){
  const v=medViewers[i], canvas=$('medCanvas-'+i);
  if(!v||!canvas||!v.img.width||!v.src)return;
  // pull current slider positions into state
  const bEl=$('medBright-'+i), cEl=$('medContrast-'+i);
  const nb=bEl?Number(bEl.value):0, nc=cEl?Number(cEl.value):100;
  if(nb!==v.bright||nc!==v.contrast){v.bright=nb;v.contrast=nc;v.dirty=true}
  if(v.dirty)medBuildSource(i);
  const ctx=canvas.getContext('2d');
  ctx.setTransform(1,0,0,1,0,0);
  ctx.fillStyle='#000';ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.save();
  ctx.translate(canvas.width/2+v.ox, canvas.height/2+v.oy);
  ctx.rotate(v.rot*Math.PI/180);
  const dw=v.img.width*v.scale, dh=v.img.height*v.scale;
  ctx.imageSmoothingEnabled=true;
  ctx.drawImage(v.src,-dw/2,-dh/2,dw,dh);
  ctx.restore();
}
function medZoom(i,f){const v=medViewers[i];if(!v)return;v.scale=Math.max(v.fit*.35,Math.min(v.fit*12,v.scale*f));medRedraw(i)}
function medReset(i){
  const v=medViewers[i];if(!v)return;
  v.scale=v.fit;v.ox=0;v.oy=0;v.rot=0;v.invert=false;v.bright=0;v.contrast=100;v.dirty=true;
  const b=$('medBright-'+i),c=$('medContrast-'+i);if(b)b.value=0;if(c)c.value=100;
  medRedraw(i);
}
function medRotate(i){const v=medViewers[i];if(!v)return;v.rot=(v.rot+90)%360;medRedraw(i)}
function medInvert(i){const v=medViewers[i];if(!v)return;v.invert=!v.invert;v.dirty=true;medRedraw(i)}
let originalView='document';
function setOriginalView(view){
  originalView=view;
  const visual=$('originalVisualPanel'),text=$('originalTextPanel');
  if(visual)visual.hidden=view!=='document';
  if(text)text.hidden=view!=='text';
  [['originalVisualBtn','document'],['originalTextBtn','text']].forEach(([id,key])=>{
    const btn=$(id);if(!btn)return;const active=view===key;
    btn.classList.toggle('active',active);btn.setAttribute('aria-pressed',active?'true':'false');
  });
  if(view==='document')setTimeout(()=>document.querySelectorAll('.doc-page[data-page]').forEach(el=>drawDocOverlay(Number(el.dataset.page))),30);
}
async function copyOriginalText(){
  const value=currentAnalysis&&currentAnalysis.rawText||'';if(!value)return;
  const btn=$('copyOriginalBtn');
  try{await navigator.clipboard.writeText(value)}catch{
    const ta=document.createElement('textarea');ta.value=value;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();
  }
  if(btn){const prior=btn.textContent;btn.textContent='Copied';setTimeout(()=>btn.textContent=prior,1600)}
}
function renderDocumentView(a){
  const scans=Array.isArray(a.scanImages)?a.scanImages:[];
  const docPages=Array.isArray(a.docPages)?a.docPages:[];
  const hasBoxedMetrics=(a.metrics||[]).some(m=>m.bbox&&Number.isInteger(m.bboxPage));
  const isImaging=a.category==='imaging'||a.category==='cardiac';
  const hasText=!isImaging&&!!a.rawText;
  const hasVisual=!!(scans.length||docPages.length);
  window.__medicalViewerImages=scans;
  let visual='';
  if(scans.length){
    visual+=scans.map((im,idx)=>`<div class="med-viewer">
      <div class="med-toolbar">
        <button aria-label="Zoom in" class="btn-secondary" onclick="medZoom(${idx},1.15)">＋</button>
        <button aria-label="Zoom out" class="btn-secondary" onclick="medZoom(${idx},.87)">－</button>
        <button class="btn-secondary" onclick="medRotate(${idx})">Rotate</button>
        <button class="btn-secondary" onclick="medInvert(${idx})">Invert</button>
        <button class="btn-secondary" onclick="medReset(${idx})">Reset</button>
      </div>
      <div class="med-stage" id="medStage-${idx}" tabindex="0"><canvas id="medCanvas-${idx}"></canvas></div>
      <div class="med-controls">
        <label>Brightness <input type="range" id="medBright-${idx}" min="-100" max="100" value="0" oninput="medRedraw(${idx})"></label>
        <label>Contrast <input type="range" id="medContrast-${idx}" min="50" max="200" value="100" oninput="medRedraw(${idx})"></label>
      </div>
      <div class="med-viewer-meta">${esc(im.name||'medical image')}
        <div class="img-ai">
          <div style="background:rgba(43,90,156,0.05);border:1px solid rgba(43,90,156,0.15);border-radius:var(--radius-sm);padding:14px;line-height:1.5;font-size:12px;color:var(--text);margin-top:10px">
            <div style="font-weight:900;color:var(--primary);margin-bottom:6px;display:flex;align-items:center;gap:6px">Diagnostic viewer active</div>
            <div>Scans stay in this browser's local storage on this device. Anyone with access to this browser profile may be able to view them. Use the toolbar above to <strong>Zoom (＋/－)</strong>, <strong>Rotate (↻)</strong>, <strong>Invert (◐)</strong>, or adjust <strong>Brightness &amp; Contrast</strong> for manual inspection. Automated AI visual parsing is disabled in this build.</div>
          </div>
        </div>
      </div></div>`).join('');
    setTimeout(()=>scans.forEach((_,i)=>initMedViewer(i)),50);
  }
  if(docPages.length)visual+=renderDocLassoViewer(docPages,hasBoxedMetrics);
  const countLabel=docPages.length?`${docPages.length} page${docPages.length===1?'':'s'}`:scans.length?`${scans.length} image${scans.length===1?'':'s'}`:'Text only';
  const switcher=hasVisual&&hasText?`<div aria-label="Original report view" class="original-switch"><button aria-pressed="true" class="active" id="originalVisualBtn" onclick="setOriginalView('document')">Report view</button><button aria-pressed="false" id="originalTextBtn" onclick="setOriginalView('text')">Extracted text</button></div>`:'';
  const visualPanel=hasVisual?`<div class="original-panel" id="originalVisualPanel">${visual}</div>`:'';
  const textPanel=hasText?`<div class="original-panel" id="originalTextPanel" ${hasVisual?'hidden':''}><div class="original-panel-head"><p>Plain text captured by the on-device parser. Use it for search and verification.</p><button class="original-copy" id="copyOriginalBtn" onclick="copyOriginalText()">Copy text</button></div><div class="doc-raw">${esc(a.rawText)}</div></div>`:'';
  const html=hasVisual||hasText?`<div class="original-shell"><div class="original-head"><div class="original-file"><strong>${esc(a.fileName||'Uploaded report')}</strong><span>${countLabel} · kept on this device</span></div>${switcher}</div>${visualPanel}${textPanel}</div>`:'<div class="empty-state"><div class="ic"><svg class="icn" aria-hidden="true" focusable="false"><use href="#i-file"/></svg></div><p>The original preview is unavailable, but any extracted values remain available.</p><button class="btn-primary" onclick="switchTab(\'detailed\')">Open extracted values</button></div>';
  const av=$('documentView'); if(av)av.innerHTML=html;
  originalView=hasVisual?'document':'text';
  if(docPages.length){
    setTimeout(()=>{
      docPages.forEach((_,pi)=>drawDocOverlay(pi));
    },60);
  }
}


// Original-report viewer: each extracted value is a tappable box over the page image.
function renderDocLassoViewer(docPages,interactive){
  const tools=interactive?`<div class="doc-lasso-toolbar"><span class="doc-lasso-hint" id="docLassoHint">Tap a highlighted value to see its details.</span></div>`:'';
  return `${tools}<div class="original-pages-frame"><div class="doc-pages" id="docPagesWrap">
    ${docPages.map((dp,pi)=>`<div class="doc-page" data-page="${pi}">
      <img src="${dp.image}" class="doc-page-img" draggable="false" alt="Report page ${pi+1}" onload="onDocPageImgLoad(${pi})">
      <svg class="doc-page-svg" id="docSvg-${pi}"></svg>
    </div>`).join('')}
  </div></div>
`;
}
function onDocPageImgLoad(pi){ drawDocOverlay(pi); }
function docMetricsOnPage(pi){
  return (currentAnalysis&&currentAnalysis.metrics||[]).filter(m=>m.bbox&&m.bboxPage===pi&&!m.flaggedWrong);
}
function drawDocOverlay(pi){
  const wrap=document.querySelector(`.doc-page[data-page="${pi}"]`); if(!wrap)return;
  const img=wrap.querySelector('.doc-page-img'); const svg=wrap.querySelector('.doc-page-svg');
  if(!img||!svg||!img.clientWidth)return;
  const w=img.clientWidth, h=img.clientHeight;
  svg.setAttribute('viewBox',`0 0 ${w} ${h}`); svg.style.width=w+'px'; svg.style.height=h+'px';
  const ms=docMetricsOnPage(pi);
  svg.innerHTML=ms.map(m=>{
    const b=m.bbox;
    const x=b.x0*w, y=b.y0*h, ww=Math.max(6,(b.x1-b.x0)*w), hh=Math.max(6,(b.y1-b.y0)*h);
    return `<rect class="doc-hit ${severityTier(m)}" data-key="${esc(m.key)}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${ww.toFixed(1)}" height="${hh.toFixed(1)}" rx="4" onclick="onDocHitTap(this)"></rect>`;
  }).join('');
}
function onDocHitTap(el){
  const key=el.getAttribute('data-key');
  if(key)openMetricSheet(key);
}
window.addEventListener('resize',()=>{document.querySelectorAll('.doc-page[data-page]').forEach(el=>drawDocOverlay(Number(el.dataset.page)));});
function changeReportCategory(k){if(!currentAnalysis)return;currentAnalysis.category=k;persistCurrent();displayResults(currentAnalysis);showToast('Report type updated','success')}
// Abnormal results surface first everywhere a metric list is shown — a
// person glancing at their report should see what needs attention before
// scrolling past a page of normal values to find it. Stable-sorts, so the
// original parse order is preserved within each status group.
// Sort priority now follows the traffic-light TIER (concern, then
  // borderline, then safe, then unknown) -- matching the Normal/High-Low/
  // Borderline grouping shown in the stat boxes, rather than the older
  // binary high/low/normal status.
  const TIER_SORT_ORDER={'tier-concern':0,'tier-borderline':1,'tier-safe':2,'tier-unknown':3};
  function metricPriority(m){ return TIER_SORT_ORDER[severityTier(m)]??3; }
// Returns {m, i} pairs, i = the metric's REAL index in the original metrics
// array -- toggleProv()/flagMetric() index directly into currentAnalysis.metrics,
// so that original index must travel with the metric through any reordering,
// never be replaced by its position in the sorted/filtered display list.
function sortMetricsForDisplay(metrics){
  return metrics.map((m,i)=>({m,i})).sort((a,b)=>{
    const p=metricPriority(a.m)-metricPriority(b.m);
    return p!==0?p:a.i-b.i;
  });
}
// metricsFilter now holds a TIER value ('tier-safe'/'tier-borderline'/
// 'tier-concern'), matching the traffic-light colour system (not the
// underlying binary status) -- so "High/Low" correctly groups both high AND
// low concerning values together, and "Borderline" correctly includes a
// technically-"normal" value that's sitting right at the edge of its range.
function filteredMetricPairs(metrics){
  const sorted=sortMetricsForDisplay(metrics);
  if(!metricsFilter)return sorted;
  if(metricsFilter==='review')return sorted.filter(x=>x.m.needsReview&&!x.m.flaggedWrong);
  return sorted.filter(x=>severityTier(x.m)===metricsFilter);
}
// Clicking a Tests/Normal/High/Low stat box filters the Details tab to just
// that group — click the same one again (or "Tests") to clear the filter.
function setMetricsFilter(status){
  metricsFilter=(metricsFilter===status)?null:status;
  if(currentAnalysis){
    renderMetricsList(currentAnalysis);
    renderQuickMetricsSummary(currentAnalysis);
  }
  if(metricsFilter)switchTab('detailed');
}
function renderQuickMetricsSummary(a){
  const el=$('quickMetricsSummary'); if(!el)return;
  // Everything outside the reference range, most out-of-range first. Nothing is capped,
  // so this list always matches the "Outside range" count above it.
  let pairs=sortMetricsForDisplay(a.metrics).filter(({m})=>severityTier(m)==='tier-concern');
  const head=document.querySelector('#tab-summary .section-title');
  if(head)head.textContent=pairs.length?`Outside the reference range (${pairs.length})`:'Key values';
  if(!pairs.length)pairs=sortMetricsForDisplay(a.metrics).slice(0,8);
  el.innerHTML=pairs.length?pairs.map(({m})=>{const t=severityTier(m);return `<button type="button" class="metric-status-item" onclick="openMetricSheet('${m.key}')" aria-label="View details for ${esc(m.name)}"><span class="status-indicator ${t}" aria-hidden="true">${t==='tier-concern'?(m.status==='low'?'<svg class="icn"><use href="#i-arrow-down"/></svg>':'<svg class="icn"><use href="#i-arrow-up"/></svg>'):t==='tier-safe'?'<svg class="icn"><use href="#i-check"/></svg>':'<svg class="icn"><use href="#i-dash"/></svg>'}</span><span class="metric-text"><h5>${esc(m.name)}</h5><p>${m.status==='high'?'High':m.status==='low'?'Low':'Value'} · ${esc(metricValueText(m))} ${esc(m.unit||'')}</p></span></button>`}).join(''):'<div class="empty-state"><p>No values were extracted.</p></div>';
}
const TIER_FILTER_LABELS={'tier-safe':'Normal','tier-borderline':'Borderline','tier-concern':'High/Low','review':'Needs verification'};
function confirmMetric(key){
  if(!currentAnalysis)return;
  const m=(currentAnalysis.metrics||[]).find(x=>x.key===key);if(!m)return;
  m.verified=true;m.needsReview=false;refreshVerification(currentAnalysis);persistCurrent();
  renderVerificationCard(currentAnalysis);renderMetricsList(currentAnalysis);
  showToast(`${m.name} marked as checked`,'success');
}
function renderMetricsList(a){
  const el=$('metricsList'); if(!el)return;
  const pairs=filteredMetricPairs(a.metrics);
  let filterChip='';
  if(metricsFilter){
    const label=TIER_FILTER_LABELS[metricsFilter]||metricsFilter;
    const filteredKeys=pairs.map(p=>p.m.key);
    const explainBtn=filteredKeys.length
      ?`<button class="btn-primary" style="font-size:12px;padding:6px 12px;margin-left:auto" onclick="explainMetricsNow([${filteredKeys.map(k=>`'${k}'`).join(',')}])">Explain all ${filteredKeys.length} with AI</button>`
      :'';
    filterChip=`<div class="metrics-filter-chip">Showing <strong>${esc(label)}</strong> only <button onclick="setMetricsFilter(null)">Clear</button>${explainBtn}</div>`;
  }
  if(!a.metrics.length){ el.innerHTML='<div class="empty-state"><div class="ic"><svg class="icn" aria-hidden="true" focusable="false"><use href="#i-file"/></svg></div><p>No parameters could be extracted.</p></div>'; return; }
  if(!pairs.length){ el.innerHTML=filterChip+'<div class="empty-state"><div class="ic"><svg class="icn" aria-hidden="true" focusable="false"><use href="#i-file"/></svg></div><p>No parameters match this filter.</p></div>'; return; }
  el.innerHTML=filterChip+pairs.map(({m,i})=>`<div class="metric-card" onclick="openMetricSheet('${m.key}')" tabindex="0" role="button" aria-label="View details for ${esc(m.name)}" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openMetricSheet('${m.key}')}"><div class="metric-icon ${severityTier(m)}"></div><div><div style="font-weight:900;font-size:13px">${esc(m.name)}</div><div class="metric-reference">${m.status==='classifier'?`Cutoffs: ${esc(m.normal_range)}${m.classifierLabel?` <span class="range-src">· pattern: ${esc(m.classifierLabel)}</span>`:''}`:`Normal: ${esc(m.normal_range)}${m.rangeNote?` <span class="range-src">· ${esc(m.rangeNote)}</span>`:''}`}</div>${m.needsReview?`<span class="review-badge">Check: ${esc((m.reviewReasons||[]).join(' · '))}</span><button class="review-confirm" onclick="event.stopPropagation();confirmMetric('${m.key}')">Mark checked</button>`:''}${m.srcLine?`<div class="prov"><button class="prov-toggle" onclick="event.stopPropagation();toggleProv(${i})">Where did this come from?</button><div class="prov-body" id="prov-${i}">${sourceCropHTML(m)}<div class="prov-label">Read from this line of your report:</div><code class="prov-line">${esc(m.srcLine)}</code><button class="prov-flag" onclick="event.stopPropagation();flagMetric(${i})"><svg class="icn" aria-hidden="true" focusable="false"><use href="#i-flag"/></svg> This value is wrong</button></div></div>`:''}</div><div class="metric-value-badge">${esc(metricValueText(m))} <span style="font-size:12px;color:var(--text-secondary)">${esc(m.unit)}</span><span class="flag" style="${m.status==='unknown'||m.status==='classifier'?'color:var(--text-secondary)':''}">${m.status==='unknown'?'NO REF. RANGE':m.status==='classifier'?'SCREENING INDEX':m.status.toUpperCase()}</span></div></div>`).join('');
}
function switchTab(name,btn){activeResultTab=name;document.querySelectorAll('#resultTabs .tab-btn').forEach(b=>{const active=btn?b===btn:b.dataset.tab===name;b.classList.toggle('active',active);b.setAttribute('aria-selected',active?'true':'false');b.tabIndex=active?0:-1});document.querySelectorAll('.results-body>.tab-content').forEach(c=>{const active=c.id==='tab-'+name;c.classList.toggle('active',active);c.hidden=!active});if(name==='comparison')displayComparison()}
function handleResultTabKey(event){
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
  const tabs=[...document.querySelectorAll('#resultTabs .tab-btn')];let i=tabs.indexOf(event.currentTarget);
  if(event.key==='Home')i=0;else if(event.key==='End')i=tabs.length-1;else i=(i+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
  event.preventDefault();tabs[i].focus();tabs[i].click();
}
function setDefaultTrendParam(key){defaultTrendKey=key;selectedTrendKey=key;LS.set('defaultTrendKey_'+(currentUser||'guest'),key);showToast('Default trend parameter saved','success');displayComparison()}
function clearDefaultTrendParam(){defaultTrendKey=null;selectedTrendKey=null;LS.del('defaultTrendKey_'+(currentUser||'guest'));showToast('Default trend cleared','info');displayComparison()}
/* ================= TRENDS =================
   Left: markers that have at least two readings, outside-range first, with a
   sparkline. Right: the selected marker on a time-proportional chart with its
   reference band, plus a readings table (one row per report). */
let trendFilter='all',trendQuery='',trendModel=null;
const TREND_GROUPS=[['blood','Blood count'],['chol','Lipids'],['sugar','Diabetes'],['liver','Liver'],['kidney','Kidney'],['electro','Electrolytes'],['thyroid','Thyroid'],['vitamin','Vitamins & iron'],['hormone','Hormones'],['cardiac','Heart'],['coag','Clotting'],['protein','Protein'],['metabolic','Metabolic'],['immuno','Immunology'],['immune','Immunology'],['urine','Urine'],['stool','Stool'],['tumour','Tumour markers'],['gases','Blood gases'],['other','Other']];
const trendGroupLabel=g=>(TREND_GROUPS.find(x=>x[0]===g)||[0,'Other'])[1];
const trendGroupRank=g=>{const k=TREND_GROUPS.findIndex(x=>x[0]===g);return k<0?99:k};
let trendRange='all',trendView='chart';
function trendSeriesFor(key){
  const seen=new Set();
  const readings=getHistory().filter(r=>Array.isArray(r.metrics)&&r.metrics.some(m=>m.key===key&&!m.flaggedWrong&&!m.excluded)).sort((a,b)=>new Date(a.date)-new Date(b.date)).map(r=>{const m=r.metrics.find(x=>x.key===key&&!x.flaggedWrong&&!x.excluded);return {date:r.date,value:m.value,valueText:metricValueText(m),unit:m.unit,name:m.name,status:m.status,fileName:r.fileName,min:m.min,max:m.max,normal_range:m.normal_range,reportId:r.id,group:m.group}});
  const latestUnit=normalizedUnit(readings[readings.length-1]?.unit);
  const compatible=readings.filter(p=>normalizedUnit(p.unit)===latestUnit);
  const result=compatible.filter(p=>{const k=p.date+'|'+p.value;if(seen.has(k))return false;seen.add(k);return true});
  result.excludedUnits=readings.length-compatible.length;
  return result;
}
// The range filter is relative to the newest reading in the data, so older reports never chart as empty.
function trendCutoff(){
  const months={'3m':3,'6m':6,'1y':12}[trendRange];
  if(!months||!trendModel||!trendModel.latestDate)return null;
  const d=new Date(trendModel.latestDate);d.setMonth(d.getMonth()-months);return d.getTime();
}
const trendInRange=series=>{const c=trendCutoff();return c==null?series:series.filter(p=>new Date(p.date).getTime()>=c)};
function setTrendRange(r){trendRange=r;renderTrendChrome();renderTrendDetail()}
function setTrendView(v){trendView=v;renderTrendChrome();renderTrendDetail()}
function setTrendParam(key){selectedTrendKey=key;trendView='chart';renderTrendChrome();renderTrendList();renderTrendDetail()}
function setTrendFilter(f){trendFilter=f;renderTrendList()}
function setTrendQuery(q){trendQuery=String(q||'').toLowerCase().trim();renderTrendList()}
const trendNum=p=>typeof p.value==='number'&&isFinite(p.value);
function trendDist(p){if(p.min!=null&&p.value<p.min)return p.min-p.value;if(p.max!=null&&p.value>p.max)return p.value-p.max;return 0}
function trendTierColor(t){return t==='tier-concern'?'var(--danger)':t==='tier-borderline'?'var(--warning)':t==='tier-safe'?'var(--success)':'var(--neon-unknown)'}
function trendStatusWord(t,p){return t==='tier-concern'?(p.status==='low'?'Below range':'Above range'):t==='tier-borderline'?'Near the edge':t==='tier-safe'?'In range':'No range'}
function niceTicks(min,max,n){
  const span=(max-min)||Math.abs(max)||1,raw=span/n,pow=Math.pow(10,Math.floor(Math.log10(raw))),f=raw/pow;
  const step=(f<1.5?1:f<3?2:f<7?5:10)*pow,out=[];
  for(let v=Math.ceil(min/step)*step;v<=max+step*1e-6;v+=step)out.push(+v.toFixed(10));
  return out;
}
const fmtTick=v=>Math.abs(v)>=1000?v.toLocaleString(undefined,{maximumFractionDigits:0}):String(+v.toFixed(3));
function trendChange(series){
  const pts=series.filter(trendNum),latest=pts[pts.length-1],prev=pts[pts.length-2],first=pts[0];
  if(!prev)return {text:'First reading',move:'',trend:'',sinceFirst:''};
  const d=+(latest.value-prev.value).toFixed(3),pct=prev.value!==0?Math.round(d/Math.abs(prev.value)*100):null;
  const dl=trendDist(latest),dp=trendDist(prev);
  const move=(dl===0&&dp===0)?'Stayed in range':dl<dp?'Moved closer to the range':dl>dp?'Moved further from the range':(d===0?'No change':'');
  // Overall direction, first to latest, against a 5% band so ordinary variation reads as stable.
  const span=(latest.min!=null&&latest.max!=null&&latest.max>latest.min)?(latest.max-latest.min):Math.abs(first.value)||1;
  const net=latest.value-first.value,trend=pts.length<3?'':Math.abs(net)/span<0.05?'Stable overall':net>0?'Rising overall':'Falling overall';
  const fp=first.value!==0?Math.round(net/Math.abs(first.value)*100):null;
  return {text:`${d>0?'+':''}${fmtTick(d)}${pct!=null&&d!==0?` (${pct>0?'+':''}${pct}%)`:''}`,since:fmtDate(prev.date,{month:'short',day:'numeric',year:'numeric'}),move,trend,sinceFirst:pts.length>2?`${net>0?'+':''}${fmtTick(+net.toFixed(3))}${fp!=null&&net!==0?` (${fp>0?'+':''}${fp}%)`:''} since ${fmtDate(first.date,{month:'short',year:'numeric'})}`:''};
}
function trendSpark(series){
  const pts=series.filter(trendNum);if(pts.length<2)return '';
  const w=64,h=22,vals=pts.map(p=>p.value),lo=Math.min(...vals),hi=Math.max(...vals),sp=(hi-lo)||1;
  const xy=pts.map((p,i)=>[2+i*(w-4)/(pts.length-1),h-3-(p.value-lo)/sp*(h-6)]);
  const last=xy[xy.length-1],t=severityTier(pts[pts.length-1]);
  return `<svg class="trend-spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><polyline points="${xy.map(a=>a.map(n=>n.toFixed(1)).join(',')).join(' ')}" fill="none" stroke="var(--border-strong)" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="2.6" fill="${trendTierColor(t)}"/></svg>`;
}
function renderTrendGraph(series){
  series=series.filter(trendNum);if(!series.length)return '';
  const latest=series[series.length-1],unit=latest.unit||'';
  const vals=series.map(p=>p.value),vLo=Math.min(...vals),vHi=Math.max(...vals),vSpan=Math.max(vHi-vLo,Math.abs(vHi)*0.1,1e-6);
  const near=b=>b!=null&&b>=vLo-4*vSpan&&b<=vHi+4*vSpan;
  const refMin=near(latest.min)?latest.min:null,refMax=near(latest.max)?latest.max:null;
  let lo=Math.min(vLo,refMin??vLo),hi=Math.max(vHi,refMax??vHi);const pad=(hi-lo||1)*0.14;lo-=pad;hi+=pad;if(lo<0&&vLo>=0)lo=0;
  const W=720,H=300,L=52,R=68,T=18,B=40,pw=W-L-R,ph=H-T-B;
  const t0=new Date(series[0].date).getTime(),t1=new Date(latest.date).getTime(),tsp=t1-t0;
  const XP=26,x=p=>L+(series.length===1||tsp===0?pw/2:XP+(new Date(p.date).getTime()-t0)/tsp*(pw-2*XP));
  const y=v=>T+(hi-v)/(hi-lo)*ph;
  const ticks=niceTicks(lo,hi,4).map(v=>`<line x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}" class="tr-grid"/><text x="${L-8}" y="${y(v)+4}" class="tr-axis" text-anchor="end">${fmtTick(v)}</text>`).join('');
  const bandTop=refMax!=null?y(Math.min(refMax,hi)):T,bandBot=refMin!=null?y(Math.max(refMin,lo)):T+ph;
  const band=(refMin!=null||refMax!=null)?`<rect x="${L}" y="${bandTop}" width="${pw}" height="${Math.max(0,bandBot-bandTop)}" class="tr-band"/>`:'';
  const edge=(v,l)=>v!=null?`<line x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}" class="tr-edge"/><text x="${W-R+6}" y="${y(v)+4}" class="tr-edge-label">${l==='max'?'upper':'lower'} ${fmtTick(v)}</text>`:'';
  const path=series.length>1?`<polyline class="tr-line" points="${series.map(p=>`${x(p).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')}"/>`:'';
  const every=Math.max(1,Math.ceil(series.length/5));
  const pts=series.map((p,i)=>{
    const t=severityTier(p),c=trendTierColor(t),cx=x(p).toFixed(1),cy=y(p.value).toFixed(1);
    const shape=t==='tier-concern'?`<path d="M${cx} ${cy-7}L${+cx+7} ${cy}L${cx} ${+cy+7}L${cx-7} ${cy}Z" fill="${c}"/>`:t==='tier-unknown'?`<circle cx="${cx}" cy="${cy}" r="5" fill="var(--card)" stroke="${c}" stroke-width="2"/>`:`<circle cx="${cx}" cy="${cy}" r="5.5" fill="${c}"/>`;
    const lab=(series.length<=8||i===series.length-1)?`<text x="${cx}" y="${cy-12}" class="tr-val" text-anchor="middle">${esc(fmtTick(p.value))}</text>`:'';
    const dl=(i%every===0||i===series.length-1)?`<text x="${cx}" y="${H-14}" class="tr-axis" text-anchor="middle">${fmtDate(p.date,{month:'short',day:'numeric',year:series.length>4?'2-digit':undefined})}</text>`:'';
    return `<g class="tr-pt" tabindex="0" role="img" aria-label="${esc(fmtDate(p.date))}: ${esc(p.valueText)} ${esc(unit)}, ${trendStatusWord(t,p)}" data-cx="${cx}" data-cy="${cy}" data-tip="${esc(fmtDate(p.date))} · ${esc(p.valueText)} ${esc(unit)} · ${trendStatusWord(t,p)}" onpointerenter="trendTip(this,true)" onpointerleave="trendTip(this,false)" onfocus="trendTip(this,true)" onblur="trendTip(this,false)"><circle cx="${cx}" cy="${cy}" r="16" fill="transparent"/>${shape}</g>${lab}${dl}`;
  }).join('');
  const differ=series.some(p=>(p.min??null)!==(latest.min??null)||(p.max??null)!==(latest.max??null));
  return `<div class="trend-plot"><svg class="trend-svg" role="group" aria-label="${esc(latest.name)} over time" viewBox="0 0 ${W} ${H}">${band}${ticks}${edge(refMax,'max')}${edge(refMin,'min')}${path}${pts}</svg><div class="trend-tip" role="status" hidden></div></div><p class="trend-note">${differ?'Ranges differed between reports; the band shows the latest. ':''}Shaded band is the reference range. Diamonds are outside it.</p>`;
}
function trendTip(g,on){
  const wrap=g.closest('.trend-plot'),tip=wrap&&wrap.querySelector('.trend-tip');if(!tip)return;
  if(!on){tip.hidden=true;return}
  tip.textContent=g.dataset.tip;tip.hidden=false;
  const svg=wrap.querySelector('svg'),k=svg.getBoundingClientRect().width/720;
  tip.style.left=Math.min(Math.max(+g.dataset.cx*k,90),svg.getBoundingClientRect().width-90)+'px';
  tip.style.top=(+g.dataset.cy*k-14)+'px';
}
function renderTrendList(){
  const host=$('trendListHost');if(!host||!trendModel)return;
  const q=trendQuery;
  const items=trendModel.items.filter(it=>(trendFilter==='all'||(trendFilter==='out'&&it.tier==='tier-concern')||(trendFilter==='edge'&&it.tier==='tier-borderline'))&&(!q||it.name.toLowerCase().includes(q)));
  const counts={all:trendModel.items.length,out:trendModel.items.filter(i=>i.tier==='tier-concern').length,edge:trendModel.items.filter(i=>i.tier==='tier-borderline').length};
  const chip=(k,l)=>`<button type="button" class="chip ${trendFilter===k?'active':''}" aria-pressed="${trendFilter===k}" onclick="setTrendFilter('${k}')">${l} <span class="chip-n">${counts[k]}</span></button>`;
  const chips=$('trendChips');if(chips)chips.innerHTML=chip('all','All')+chip('out','Outside range')+chip('edge','Near the edge');
  const sel=$('trendMarkerSelect');
  if(sel)sel.innerHTML=trendModel.items.map(it=>`<option value="${esc(it.key)}" ${it.key===selectedTrendKey?'selected':''}>${esc(trendGroupLabel(it.group))} · ${esc(it.name)}</option>`).join('');
  const row=it=>{const cur=it.key===selectedTrendKey;return `<li class="trend-row ${cur?'is-current':''}"><button type="button" class="trend-param-button" aria-current="${cur}" onclick="setTrendParam('${esc(it.key)}')">${esc(it.name)}</button><span class="trend-row-meta"><span class="trend-row-val"><span class="dot" style="background:${trendTierColor(it.tier)}"></span>${esc(it.latest.valueText)} <small>${esc(it.unit||'')}</small></span>${trendSpark(it.series)}</span></li>`};
  const rank={'tier-concern':0,'tier-borderline':1,'tier-safe':2,'tier-unknown':3};
  const byGroup=new Map();items.forEach(it=>{const k=trendGroupLabel(it.group);if(!byGroup.has(k))byGroup.set(k,{rank:trendGroupRank(it.group),items:[]});byGroup.get(k).items.push(it)});
  host.innerHTML=items.length?[...byGroup.entries()].sort((a,b)=>a[1].rank-b[1].rank).map(([label,g])=>`<li class="trend-group" role="presentation">${esc(label)}</li>`+g.items.sort((a,b)=>rank[a.tier]-rank[b.tier]||a.name.localeCompare(b.name)).map(row).join('')).join(''):'<li class="trend-none">No markers match.</li>';
}

function renderTrendChrome(){
  const el=$('trendChrome');if(!el||!trendModel)return;
  const seg=(items,cur,fn)=>`<div class="seg" role="group">${items.map(([k,l])=>`<button type="button" class="${cur===k?'active':''}" aria-pressed="${cur===k}" onclick="${fn}('${k}')">${l}</button>`).join('')}</div>`;
  el.innerHTML=seg([['chart','Chart'],['table','Flowsheet']],trendView,'setTrendView')+seg([['3m','3M'],['6m','6M'],['1y','1Y'],['all','All']],trendRange,'setTrendRange');
}
// Flowsheet: one row per marker, one column per report date, the layout clinicians know from EHR lab views.
function renderTrendFlowsheet(){
  const reports=trendModel.reports.filter(r=>{const c=trendCutoff();return c==null||new Date(r.date).getTime()>=c});
  const cols=reports.slice(-8);
  if(!cols.length)return '<p class="trend-note">No reports in this range.</p>';
  const flag=(t,p)=>t==='tier-concern'?(p.status==='low'?'L':'H'):'';
  const bodyRows=[];let last='';
  const items=trendModel.items.slice().sort((a,b)=>trendGroupRank(a.group)-trendGroupRank(b.group)||a.name.localeCompare(b.name));
  items.forEach(it=>{
    const g=trendGroupLabel(it.group);
    if(g!==last){bodyRows.push(`<tr class="fs-group"><th colspan="${cols.length+2}" scope="colgroup">${esc(g)}</th></tr>`);last=g}
    const byDate=new Map(it.allSeries.map(p=>[p.reportId,p]));
    const cells=cols.map(r=>{const p=byDate.get(r.id);if(!p)return '<td class="fs-empty">—</td>';const t=severityTier(p);return `<td class="fs-cell" data-t="${t}"><span class="fs-v">${esc(p.valueText)}</span>${flag(t,p)?`<span class="fs-flag">${flag(t,p)}</span>`:''}</td>`}).join('');
    const pts=it.series.filter(trendNum),d=pts.length>1?pts[pts.length-1].value-pts[pts.length-2].value:null;
    bodyRows.push(`<tr><th scope="row" class="fs-name"><button type="button" class="trend-param-button" onclick="setTrendParam('${esc(it.key)}')">${esc(it.name)}</button><small>${esc(it.unit||'')}</small></th>${cells}<td class="fs-delta">${d==null?'':(d>0?'▲':d<0?'▼':'•')}</td></tr>`);
  });
  return `<div class="trend-table-wrap fs-wrap"><table class="trend-table flowsheet"><thead><tr><th scope="col">Marker</th>${cols.map(r=>`<th scope="col">${esc(fmtDate(r.date,{month:'short',day:'numeric',year:'2-digit'}))}</th>`).join('')}<th scope="col" title="Change since the previous reading">Δ</th></tr></thead><tbody>${bodyRows.join('')}</tbody></table></div><p class="trend-note">H and L flag values outside the reference range printed on each report. ▲ ▼ show the change since the previous reading.</p>`;
}
function renderTrendDetail(){
  const host=$('trendDetail');if(!host)return;
  if(trendView==='table'){host.innerHTML=renderTrendFlowsheet();return}
  const all=trendSeriesFor(selectedTrendKey),series=trendInRange(all),pts=series.filter(trendNum);
  if(!all.length){host.innerHTML='';return}
  const latest=all[all.length-1],unit=latest.unit||'',t=severityTier(latest),ch=trendChange(series.length>1?series:all),def=defaultTrendKey===selectedTrendKey;
  const range=latest.normal_range?String(latest.normal_range):(latest.min!=null||latest.max!=null?`${latest.min??''} – ${latest.max??''}`:'Not stated');
  const unitsDiffer=all.excludedUnits>0;
  const rows=series.slice().reverse().map(p=>{const tt=severityTier(p);return `<tr><td>${esc(fmtDate(p.date))}</td><td class="num"><strong>${esc(p.valueText)}</strong> <small>${esc(p.unit||'')}</small></td><td><span class="trend-status" style="--c:${trendTierColor(tt)}">${trendStatusWord(tt,p)}</span></td><td class="ref">${esc(p.normal_range||'—')}</td><td class="src">${esc((p.fileName||'Report').slice(0,32))}</td></tr>`}).join('');
  const sub=[`${all.length} reading${all.length===1?'':'s'}`,unit?esc(unit):'',trendRange!=='all'?`showing ${series.length} in range`:''].filter(Boolean).join(' · ');
  host.innerHTML=`<div class="trend-graph-card"><div class="trend-graph-title"><div class="trend-heading"><strong>${esc(latest.name)}</strong><span>${sub}</span></div><button type="button" class="trend-default-btn ${def?'active':''}" aria-pressed="${def}" onclick="${def?'clearDefaultTrendParam()':`setDefaultTrendParam('${esc(selectedTrendKey)}')`}">${def?'Pinned as default':'Pin as default'}</button></div><dl class="trend-summary"><div class="trend-summary-item"><dt>Latest</dt><dd><strong>${esc(latest.valueText)} ${esc(unit)}</strong><span class="trend-status" style="--c:${trendTierColor(t)}">${trendStatusWord(t,latest)}</span></dd></div><div class="trend-summary-item"><dt>Since previous</dt><dd><strong class="trend-change">${esc(ch.text)}</strong>${ch.since?`<span>${esc(ch.since)}</span>`:''}${ch.move?`<span>${ch.move}</span>`:''}</dd></div><div class="trend-summary-item"><dt>Overall</dt><dd><strong>${esc(ch.trend||'—')}</strong>${ch.sinceFirst?`<span>${esc(ch.sinceFirst)}</span>`:''}</dd></div><div class="trend-summary-item"><dt>Reference range</dt><dd><strong>${esc(range)}</strong></dd></div></dl>${pts.length?renderTrendGraph(series):'<p class="trend-note">No numeric readings in this range.</p>'}${unitsDiffer?`<p class="trend-note trend-warn">${all.excludedUnits} reading${all.excludedUnits===1?'':'s'} with different units excluded from this chart and change calculations.</p>`:''}</div><section class="trend-table-section"><h5>Readings</h5><div class="trend-table-wrap"><table class="trend-table"><thead><tr><th>Date</th><th>Value</th><th>Status</th><th>Reference</th><th>Report</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
}
function displayComparison(){
  const el=$('comparisonList');if(!currentAnalysis){el.innerHTML='';return}
  const reports=getHistory().filter(r=>Array.isArray(r.metrics)&&r.metrics.length);
  if(reports.length<2){el.innerHTML='<div class="empty-state" style="grid-column:1/-1"><div class="ic"><svg class="icn" aria-hidden="true" focusable="false"><use href="#i-trends"/></svg></div><p>Trends need at least two dated reports for this profile.</p><button class="btn-primary" onclick="resetAll()">Add another report</button></div>';return}
  const keys=new Map();reports.forEach(r=>r.metrics.forEach(m=>{if(!m.flaggedWrong&&!m.excluded&&!keys.has(m.key))keys.set(m.key,m.name)}));
  const rank={'tier-concern':0,'tier-borderline':1,'tier-safe':2,'tier-unknown':3};
  const items=[];keys.forEach((name,key)=>{const series=trendSeriesFor(key),pts=series.filter(trendNum);if(pts.length<2)return;const latest=pts[pts.length-1];items.push({key,name:latest.name||name,unit:latest.unit,series:pts,allSeries:series,latest,n:pts.length,tier:severityTier(latest),group:latest.group})});
  items.sort((a,b)=>rank[a.tier]-rank[b.tier]||b.n-a.n||a.name.localeCompare(b.name));
  if(!items.length){el.innerHTML='<div class="empty-state" style="grid-column:1/-1"><div class="ic"><svg class="icn" aria-hidden="true" focusable="false"><use href="#i-trends"/></svg></div><p>No marker appears in more than one report yet, so there is nothing to trend.</p></div>';return}
  trendModel={items,reports:reports.slice().sort((a,b)=>new Date(a.date)-new Date(b.date)),latestDate:reports.reduce((m,r)=>Math.max(m,new Date(r.date).getTime()),0)};
  if(!selectedTrendKey||!items.some(i=>i.key===selectedTrendKey))selectedTrendKey=(defaultTrendKey&&items.some(i=>i.key===defaultTrendKey)?defaultTrendKey:items[0].key);
  const hidden=keys.size-items.length;
  el.innerHTML=`<div class="trend-workspace"><aside class="trend-side" aria-label="Markers"><div class="trend-tools"><input type="search" class="history-search" id="trendSearch" placeholder="Search markers" aria-label="Search markers" value="${esc(trendQuery)}" oninput="setTrendQuery(this.value)"/><div class="trend-chips" id="trendChips"></div><label class="trend-select-mobile"><span class="sr-only">Marker</span><select id="trendMarkerSelect" onchange="setTrendParam(this.value)"></select></label></div><ul class="trend-list" id="trendListHost"></ul>${hidden>0?`<p class="trend-note">${hidden} marker${hidden===1?' has':'s have'} only one reading and can’t be trended yet.</p>`:''}</aside><div class="trend-main"><div class="trend-chrome" id="trendChrome"></div><div id="trendDetail"></div></div></div>`;
  renderTrendChrome();renderTrendList();renderTrendDetail();
}
function showInfo(){renderProfilesList();['uploadSection','historySection'].forEach(i=>{const e=$(i);if(e)e.style.display='none'});$('resultsSection').classList.remove('active');$('progressSection').classList.remove('active');$('infoSection').style.display='block';setActiveNav('info');window.scrollTo({top:0,behavior:'smooth'})}
function hideInfo(){const e=$('infoSection');if(e)e.style.display='none'}
function addAnotherPage(){const b=$('addReportBtn');if(b)b.click()}
function printDoctorSummary(username){
  const u=users.find(x=>x.username===username);if(!u)return;
  const stored=LS.get('health_reports_'+username,[]);
  const reports=Array.isArray(stored)?stored.map(normalizeAnalysisRecord).filter(Boolean):[];
  if(!reports.length)return showToast('This profile has no reports to summarize yet.','info');
  const o=profileOverview(reports),rows=latestReadings(reports),a=ageYears(u.dob);
  const flagged=s=>s&&s!=='normal'&&s!=='unknown'&&s!=='classifier';
  const who=[u.sex==='female'?'Female':u.sex==='male'?'Male':'',a!=null?a+' years':''].filter(Boolean).join(' · ');
  $('doctorPrint').innerHTML=`<h1>Health summary: ${esc(u.nickname||u.username)}</h1><p class="dp-sub">${esc(who)}${who?' · ':''}${reports.length} report${reports.length===1?'':'s'} · Prepared ${esc(fmtDate(new Date().toISOString()))}</p>
<h2>Notable changes since the previous report</h2>${o.changes.length?`<ul>${o.changes.map(c=>`<li>${esc(c.text)} (${esc(c.detail)})</li>`).join('')}</ul>`:'<p>None.</p>'}
<h2>Latest value of each test</h2><table><thead><tr><th>Test</th><th>Result</th><th>Reference range</th><th>Previous</th><th>Date</th></tr></thead><tbody>${rows.map(r=>`<tr><td class="${flagged(r.status)?'flag':''}">${esc(r.name)}${flagged(r.status)?' ('+esc(r.status)+')':''}</td><td>${esc(r.value)} ${esc(r.unit)}</td><td>${esc(r.range)}</td><td>${esc(r.prior)}</td><td>${esc(fmtDate(r.date,{month:'short',day:'numeric',year:'numeric'}))}</td></tr>`).join('')}</tbody></table>
<p class="dp-note">Prepared with LabLens from the patient’s uploaded reports. Values were read automatically and may contain errors; please check against the original reports. This is not a diagnosis or medical advice.</p>`;
  document.body.classList.add('print-summary');
  const done=()=>{document.body.classList.remove('print-summary');window.removeEventListener('afterprint',done)};
  window.addEventListener('afterprint',done);
  window.print();
}
function renderFamily(){
  const host=$('familyList'),wrap=$('familySection');if(!host||!wrap)return;
  const cards=users.map(u=>{
    const stored=LS.get('health_reports_'+u.username,[]);
    const reports=Array.isArray(stored)?stored.map(normalizeAnalysisRecord).filter(Boolean):[];
    return {u,o:profileOverview(reports)};
  });
  const multi=users.length>1;
  wrap.hidden=!(multi||cards.some(c=>c.o.count));
  $('familyTitle').textContent=multi?'Your family':'Your health';
  $('familyHint').textContent=multi?'Each person has their own profile, reports and trends. Open a card to switch to that person.':'Reports and trends for this profile. Add a family member to keep their reports separate.';
  host.innerHTML=cards.map(({u,o})=>{
    const a=ageYears(u.dob),sub=[u.sex==='female'?'Female':u.sex==='male'?'Male':'',a!=null?a+' years':''].filter(Boolean).join(' · ');
    const body=o.count?`<span class="fam-meta">${esc(fmtDate(o.latestDate,{month:'short',day:'numeric',year:'numeric'}))} · ${o.total} value${o.total===1?'':'s'} · ${o.outOfRange?`<b class="out">${o.outOfRange} outside range</b>`:'all in range'}</span>${o.changes.length?`<ul>${o.changes.map(c=>`<li class="${c.trend}">${esc(c.text)}<small>${esc(c.detail)}</small></li>`).join('')}</ul>`:(o.count>1?'<span class="fam-meta">No notable changes since the last report</span>':'<span class="fam-meta">Add another report to see trends</span>')}`:'<span class="fam-meta">No reports yet</span>';
    const cur=u.username===currentUser;
    return `<li class="family-card" ${cur?'aria-current="true"':''}><button type="button" class="family-open" data-user="${esc(u.username)}" onclick="switchUser(this.dataset.user)" aria-label="Open ${esc(u.nickname||u.username)}"><strong>${esc(u.nickname||u.username)}${cur?' <span class="fam-badge">Viewing</span>':''}</strong>${sub?`<small>${esc(sub)}</small>`:''}${body}</button><div class="family-actions"><button type="button" class="btn-secondary" data-user="${esc(u.username)}" onclick="printDoctorSummary(this.dataset.user)"${o.count?'':' disabled'} title="Save a printable summary to share with a doctor">Doctor summary (PDF)</button></div></li>`;
  }).join('');
}
function renderRecents(){
  try{renderFamily()}catch{}
  document.body.classList.toggle('has-reports',getHistory().length>0);
  const host=$('recentList'),wrap=$('recentSection');if(!host||!wrap)return;
  const rows=getHistory().slice().sort((a,b)=>new Date(b.analyzedAt||b.date)-new Date(a.analyzedAt||a.date)).slice(0,3);
  wrap.hidden=!rows.length;
  host.innerHTML=rows.map(r=>{const out=r.outOfRangeCount||0,rid=esc(''+r.id);return `<li><button type="button" class="recent-row" onclick="openHistoryItem('${rid}')"><span class="recent-main"><strong>${esc(fmtDate(r.date))}</strong><small>${esc((r.fileName||'Report').slice(0,40))}</small></span><span class="recent-meta">${r.totalMetrics||0} values · ${out?`<b class="out">${out} outside range</b>`:'all in range'}</span></button></li>`}).join('');
}
function showCurrentAnalysis(){hideInfo();if(!currentAnalysis){currentAnalysis=getHistory().slice().sort((a,b)=>new Date(b.date)-new Date(a.date))[0]||null}if(!currentAnalysis){showToast('No current analysis yet. Upload and analyze a report first.','info');return}$('historySection').style.display='none';$('uploadSection').style.display='none';displayResults(currentAnalysis);setActiveNav('current');$('resultsSection').scrollIntoView({behavior:'smooth',block:'start'})}
function showHistory(){hideInfo();$('uploadSection').style.display='none';$('resultsSection').classList.remove('active');$('historySection').style.display='block';setActiveNav('history');renderHistoryList()}function filteredHistory(){
  const q=historyFilter.q.toLowerCase().trim();
  return getHistory().slice().sort((a,b)=>new Date(b.date)-new Date(a.date)).filter(r=>{
    if(historyFilter.status==='issues'&&(r.outOfRangeCount||0)===0)return false;
    if(historyFilter.status==='normal'&&(r.outOfRangeCount||0)>0)return false;
    if(!q)return true;
    // Search EVERYTHING: filename, type, tags, notes, every marker name, and the
    // full report text. A pathology report from 2019 should be findable by a word
    // that appears only in its body.
    const hay=[
      r.fileName||'', catMeta(r.category).label||'',
      (r.tags||[]).join(' '), r.notes||'',
      (r.metrics||[]).map(m=>m.name+' '+m.value+' '+(m.unit||'')).join(' '),
      (r.medDrafts||[]).map(m=>m.name).join(' '),
      r.rawText||''
    ].join(' ').toLowerCase();
    return hay.includes(q);
  });
}
let historyView=LS.get('historyView','cards');
function setHistoryView(v){historyView=v;LS.set('historyView',v);renderHistoryList();}
function renderTimeline(rows){
  if(!rows.length)return '<div class="empty-state"><div class="ic"><svg class="icn" aria-hidden="true" focusable="false"><use href="#i-history"/></svg></div><p>No reports yet.</p></div>';
  let out='<div class="timeline">',lastYear=null;
  rows.forEach(r=>{
    const y=new Date(r.date).getFullYear();
    if(y!==lastYear){out+=`<div class="tl-year">${y}</div>`;lastYear=y}
    const bits=[];
    if(r.totalMetrics)bits.push(`${r.totalMetrics} value(s)`);
    if(r.outOfRangeCount)bits.push(`${r.outOfRangeCount} out of range`);
    if(r.medDrafts&&r.medDrafts.length)bits.push(`${r.medDrafts.length} medicine(s)`);
    out+=`<div aria-label="Open ${esc(r.fileName||'Health Report')}" class="tl-item" onclick="openHistoryItem('${r.id}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openHistoryItem('${r.id}')}" role="button" tabindex="0">
      <span class="tl-date">${fmtDate(r.date,{month:'short',day:'numeric'})}</span>
      <span>${esc(catMeta(r.category).icon)} <strong>${esc(r.fileName)}</strong>
      <div style="font-size:12.5px;color:var(--text-secondary)">${esc(catMeta(r.category).label)}${bits.length?' · '+bits.join(' · '):''}</div></span></div>`;
  });
  return out+'</div>';
}
function renderHistoryList(){try{renderRecents()}catch{}
const rows=filteredHistory();const list=$('historyList');const vb=$('historyViewBtns');if(vb)vb.innerHTML=`<button class="chip ${historyView==='cards'?'active':''}" onclick="setHistoryView('cards')">Cards</button><button class="chip ${historyView==='timeline'?'active':''}" onclick="setHistoryView('timeline')">Timeline</button>`;if(historyView==='timeline'&&getHistory().length){list.innerHTML=renderTimeline(rows);return}if(!getHistory().length){list.innerHTML='<div class="empty-state"><div class="ic"><svg class="icn" aria-hidden="true" focusable="false"><use href="#i-file"/></svg></div><p>No reports yet.</p><button class="btn-primary" onclick="resetAll()">Add your first report</button></div>';return}if(!rows.length){list.innerHTML='<div class="empty-state"><div class="ic"><svg class="icn" aria-hidden="true" focusable="false"><use href="#i-search"/></svg></div><p>No reports match your filter.</p><button class="btn-secondary" onclick="setHistoryFilter(\'status\',\'all\')">Clear filters</button></div>';return}list.innerHTML=rows.map(r=>{const cm=catMeta(r.category),ok=(r.outOfRangeCount||0)===0;return`<div aria-label="Open ${esc(r.fileName||'Health Report')}" class="history-item" onclick="loadHistoryReport('${r.id}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();loadHistoryReport('${r.id}')}" role="button" tabindex="0"><div class="history-date-icon" style="background:rgba(43,90,156,.12);color:var(--primary)">${cm.icon}</div><div class="history-date-info"><div class="history-file-name">${esc(r.fileName||'Health Report')}</div><div class="history-date">${fmtDate(r.date,{month:'short',day:'numeric',year:'2-digit'})} · ${r.totalMetrics||0} tests · ${cm.label}</div></div><span class="history-status ${ok?'ok':'warn'}">${ok?'In range':r.outOfRangeCount+' outside range'}</span><button aria-label="Delete ${esc(r.fileName||'report')}" class="history-delete" onclick="event.stopPropagation();deleteHistoryItem('${r.id}')">Delete</button></div>`}).join('')}
function setHistoryFilter(which,val){historyFilter[which]=val;if(which==='status')document.querySelectorAll('.chip[data-status]').forEach(c=>c.classList.toggle('active',c.dataset.status===val));renderHistoryList()}function loadHistoryReport(id){const r=getHistory().find(x=>String(x.id)===String(id));if(r){$('historySection').style.display='none';displayResults(r)}}function openHistoryItem(id){return loadHistoryReport(id)}
async function deleteHistoryItem(id){if(!await confirmDialog('Delete this report?'))return;setHistory(getHistory().filter(x=>String(x.id)!==String(id)));renderHistoryList();updateUserInfoDisplay();renderNav();showToast('Deleted','info')}async function clearHistory(){if(await confirmDialog('Delete all reports for this profile?')){setHistory([]);renderHistoryList();updateUserInfoDisplay();renderNav();showToast('History cleared','success')}}

function resetAll(){hideInfo();try{renderRecents()}catch{}uploadedFiles=[];updateFilePreview();$('resultsSection').classList.remove('active');$('progressSection').classList.remove('active');$('historySection').style.display='none';$('uploadSection').style.display='grid';setActiveNav('new');renderNav();window.scrollTo({top:0,behavior:'smooth'})}function showHome(){try{renderUpcoming()}catch(e){}
  const ms=$('medsSection');if(ms)ms.style.display='none';if(currentAnalysis){showCurrentAnalysis();return}$('historySection').style.display='none';$('uploadSection').style.display='grid';setActiveNav('new');window.scrollTo({top:0,behavior:'smooth'})}function printResults(){window.print()}function exportReportPDF(){window.print()}



function trendContext(){
  const hist=getHistory().map(r=>Object.assign({},r,{metrics:(r.metrics||[]).filter(m=>!m.flaggedWrong&&!m.excluded)})).filter(r=>Array.isArray(r.metrics)&&r.metrics.length)
    .sort((a,b)=>new Date(a.date)-new Date(b.date));
  if(hist.length<2)return 'TRENDS: only one dated report is saved, so no trend history is available yet.';
  const keys=[];hist.forEach(r=>r.metrics.forEach(m=>{if(!keys.some(k=>k.key===m.key))keys.push({key:m.key,name:m.name,unit:m.unit})}));
  const lines=keys.slice(0,25).map(k=>{
    const series=trendSeriesFor(k.key),pts=series.map(p=>`${fmtDate(p.date,{month:'short',year:'2-digit'})}=${p.valueText}`);
    return pts.length>1?`${k.name} (${series[series.length-1].unit||''}): ${pts.join(' → ')}`:null;
  }).filter(Boolean);
  return lines.length?`TRENDS ACROSS ${hist.length} SAVED REPORTS (oldest → newest):\n`+lines.join('\n'):'TRENDS: no repeated parameters across reports yet.';
}
function severityOf(m){
  if(m.status==='normal')return 'in range';
  if(m.status==='classifier')return m.classifierLabel||'screening index, not a high/low result';
  if(typeof m.value!=='number'||!isFinite(m.value))return m.status.toUpperCase()+' — '+String(m.value||'');
  const span=(isFinite(m.max)&&isFinite(m.min))?(m.max-m.min):Math.abs(m.max||m.min||1);
  const over=m.status==='high'?(m.value-m.max):(m.min-m.value);
  const r=span>0?over/span:0;
  return m.status.toUpperCase()+(r>1?' — a long way outside the range':r>0.35?' — clearly outside the range':' — only slightly outside the range');
}

// Traffic-light severity for the AT-A-GLANCE icon colour. This is a SEPARATE
// dimension from m.status (which stays the binary "outside the reference range,
// yes/no" used for counting, filtering and the AI — untouched, still fully correct).
// Here we ALSO ask "how close is this value to the line" on both sides of every
// boundary — a result sitting just inside the edge reads amber, same as one
// sitting just outside it, rather than jumping straight from green to full red
// the instant a value crosses the printed range.
function severityTier(m){
  // Four mutually exclusive buckets that always add up to the total:
  //   concern    outside the reference range (status high/low)
  //   borderline inside the range but within 15% of an edge
  //   safe       inside the range
  //   unknown    no comparable range (informational, screening cutoffs)
  if(m.status==='unknown'||m.status==='classifier')return 'tier-unknown';
  if(m.status==='high'||m.status==='low')return 'tier-concern';
  if(m.status!=='normal')return 'tier-unknown';
  if(!isFinite(m.value))return 'tier-safe';
  const hasMin=isFinite(m.min), hasMax=isFinite(m.max);
  if(!hasMin&&!hasMax)return 'tier-unknown';
  const span=(hasMin&&hasMax)?(m.max-m.min):Math.abs((hasMax?m.max:m.min)||1);
  if(span<=0)return 'tier-safe';
  const nearest=Math.min(hasMin?(m.value-m.min):Infinity,hasMax?(m.max-m.value):Infinity);
  return (nearest/span<0.15)?'tier-borderline':'tier-safe';
}
function reportContext(){
  const a=currentAnalysis;
  if(!a)return 'No report is open right now.';
  const ms=(a.metrics||[]).filter(m=>!m.flaggedWrong&&!m.excluded);
  const bad=ms.filter(m=>m.status!=='normal' && m.status!=='unknown' && m.status!=='classifier'), ok=ms.filter(m=>m.status==='normal');
  // Previous dated report of the same profile, for "what changed" context.
  const hist=getHistory().filter(r=>Array.isArray(r.metrics)&&r.metrics.length&&String(r.id)!==String(a.id))
    .sort((x,y)=>new Date(y.date)-new Date(x.date));
  const prev=hist.find(r=>new Date(r.date)<new Date(a.date));
  const changes=prev?ms.map(m=>{
    const p=(prev.metrics||[]).find(x=>x.key===m.key&&!x.flaggedWrong&&!x.excluded&&comparableUnit(x.unit,m.unit)); if(!p||typeof m.value!=='number'||typeof p.value!=='number')return null;
    const d=+(m.value-p.value).toFixed(2);
    return `${m.name}: was ${p.value} on ${fmtDate(prev.date,{month:'short',year:'2-digit'})}, now ${metricValueText(m)} (${d>0?'up':d<0?'down':'no change'}${d?' '+Math.abs(d):''})`;
  }).filter(Boolean):[];

  // Build a structured <analysis> block with explicit <Normal> / <Not normal> tags
  // for every value. The AI is REQUIRED by rule 8 to only call a value normal or not
  // when one of these tags is present — so we always emit one per known-status metric.
  // Values with no trustworthy reference range are wrapped in <Unknown> so the AI
  // can refuse to classify them rather than guess.
  const analysisLines=ms.map(m=>{
    if(m.status==='normal')       return `  <value name="${m.name}">${metricValueText(m)} ${m.unit||''} <Normal/></value>`;
    if(m.status==='high'||m.status==='low') return `  <value name="${m.name}">${metricValueText(m)} ${m.unit||''} <Not normal/></value>`;
    return `  <value name="${m.name}">${metricValueText(m)} ${m.unit||''} <Unknown/></value>`; // 'unknown' = no reference range
  }).join('\n');

  return `REPORT: ${a.fileName}
DATE OF REPORT: ${fmtDate(a.date)}
TYPE: ${catMeta(a.category).label}

<analysis>
The following values were extracted from the uploaded report by OCR. Each value is wrapped in a tag that states whether it is normal, not normal, or unknown (no reference range to compare against). You MUST check the tag before saying a value is normal or not.
${analysisLines || '  (no values were extracted)'}
</analysis>

PLAIN-LANGUAGE SUMMARY (for you to rewrite, not to copy):
${ms.length} values were read from the report (this includes ANY reading OCR could pull from the file — lab values, imaging, cardiac, eye, vital signs, etc., not just lab tests). ${bad.length} are flagged as not normal, ${ok.length} are flagged as normal. Values without a <Normal> or <Not normal> tag have no reference range and you must not classify them.

${bad.length?'VALUES FLAGGED <Not normal>:\n'+bad.map(m=>`- ${m.name}: ${metricValueText(m)} ${m.unit} | normal is ${m.min} to ${isFinite(m.max)?m.max:'+'} | ${severityOf(m)}${m.phased?' | NOTE: the normal range for this hormone changes with the menstrual cycle phase and menopause, so this comparison is only a rough guide':''}`).join('\n'):'VALUES FLAGGED <Not normal>: none'}

${ok.length?'VALUES FLAGGED <Normal>:\n'+ok.map(m=>`- ${m.name}: ${metricValueText(m)} ${m.unit} (normal ${m.min}-${isFinite(m.max)?m.max:'+'})`).join('\n'):'VALUES FLAGGED <Normal>: none'}

${ms.some(m=>m.status==='unknown')?'VALUES WITH NO REFERENCE RANGE (<Unknown>) — do not call these normal or not:\n'+ms.filter(m=>m.status==='unknown').map(m=>`- ${m.name}: ${metricValueText(m)} ${m.unit} (range not stated on the report)`).join('\n'):''}

${changes.length?'CHANGE SINCE THE PREVIOUS REPORT:\n'+changes.map(c=>'- '+c).join('\n')+'\n':''}
${trendContext()}`;
}
const AI_SYSTEM=
  'You are a kind helper who explains medical reports in VERY simple everyday words, '+
  'as if explaining to a smart child. The person is not a doctor and is often worried.\n'+
  'HARD RULES:\n'+
  '1. Use ONLY the numbers in the report brief you are given. NEVER invent a value.\n'+
  '2. NEVER name a disease, never diagnose, never suggest medicines or doses.\n'+
  '3. Output ONLY the final answer. No thinking, no steps, no notes-to-self, no tags.\n'+
  '4. Short friendly sentences. No medical jargon — if you must use a word like "creatinine", '+
  'immediately explain it in plain words (e.g. "a waste product your kidneys clean out").\n'+
  '5. For each out-of-range value say: what it is in plain words, whether it is high or low, '+
  'whether it is a little or a lot, and what that part of the body generally does.\n'+
  '6. Be calm and reassuring in tone, never alarming. Finish with one short line telling them '+
  'to go over the results with their doctor.\n'+
  '7. Keep the whole answer under about 200 words unless asked for more.\n'+
  '8. NORMAL / NOT NORMAL CHECK — MANDATORY: You must NEVER state that a value is "normal", '+
  '"abnormal", "out of range", "high", "low", "in range", or otherwise imply that a value is '+
  'normal or not, UNLESS you have first looked at the <Normal> or <Not normal> tag for that '+
  'value inside the <analysis> block of the report brief. If the <analysis> block (or a value '+
  'within it) has NO <Normal> or <Not normal> tag, you must say so plainly and refuse to '+
  'judge that value (e.g. "the app did not flag this as normal or not, so I cannot say"). '+
  'If the report brief does not contain an <analysis> block with these tags at all, you must '+
  'not classify any value as normal or not — instead say "I do not have the normal/not-normal '+
  'tags for this report, so I cannot say whether each value is normal or not". This rule is '+
  'absolute: a guessed normal/not-normal answer is worse than no answer.\n'+
  '9. OCR SCOPE — You may read and discuss ANY test, value, reading, or measurement that was '+
  'extracted by OCR from the uploaded reports, not just laboratory values. This includes but '+
  'is not limited to: imaging readings (X-ray, CT, MRI, ultrasound measurements), cardiac '+
  'readings (ECG, echo, blood pressure, ejection fraction, heart rate), eye / vision readings '+
  '(visual acuity, intraocular pressure, refraction), vital signs, body measurements, and any '+
  'other number or reading pulled from an uploaded report. You are NOT limited to "lab" reports. '+
  'Always base your answer on whatever the report brief actually contains, and still obey rule 8 '+
  '(only call a value normal or not if the <Normal> / <Not normal> tag is present).\n'+
  '10. STAY ON TOPIC — MANDATORY: You only discuss this person\'s uploaded health reports, the '+
  'values in them, trends across their reports, their saved medicines, and general everyday '+
  'wellness/lifestyle tips directly related to those results (diet, sleep, exercise, hydration). '+
  'If asked about anything else — general knowledge, other people, current events, coding, '+
  'creative writing, or any topic unrelated to this person\'s own health reports — decline briefly '+
  'and kindly, and steer back to their reports (e.g. "I can only help with your uploaded health '+
  'reports — is there a result you\'d like explained?"). Do not answer the off-topic question '+
  'even partially.';
// A single worked example locks the tone/format — this is what lifts a small on-device
// model from vague waffle to consistently useful, simple answers.
const AI_STYLE_EXAMPLE_Q='Explain my results simply';
const AI_STYLE_EXAMPLE_A=`Most of your results look fine. A few need a doctor's eye:

• **Haemoglobin — a bit low (10.4).** Haemoglobin is the part of your blood that carries oxygen around your body. When it is low you can feel tired or out of breath.

• **Creatinine — slightly high (1.28).** Creatinine is a waste product your kidneys clean out of your blood. A higher number can mean the kidneys are working a little harder than usual.

• **Platelets — a little low (131).** Platelets help your blood form scabs when you get a cut.

Everything else, like your white blood cells, is sitting in the normal band.

None of this tells us the cause on its own. Please go through these numbers with your doctor — they can see the whole picture.`;


/* ================= MEDICATIONS =================
   SAFETY MODEL — read this before changing anything here.
   A prescription is OCR'd or PDF-parsed, and OCR *will* sometimes misread a dose
   (5mg -> 50mg) or drop a frequency. Handwritten prescriptions are the worst case
   of all. So the parser NEVER creates an active medicine or reminder by itself.

   Flow:  parse  ->  DRAFT card (with the source line shown)  ->  user checks and
          confirms each medicine  ->  only then does it become a schedule item.

   The app never suggests a dose, never changes one, and never checks interactions.
   It only remembers what the doctor already wrote.                                */



function confirmDialog(message){
  return new Promise(resolve=>{
    const overlay=$('confirmDialogOverlay');
    $('confirmDialogText').textContent=message;
    overlay.classList.add('active');
    const cleanup=(result)=>{
      overlay.classList.remove('active');
      okBtn.removeEventListener('click',onOk);
      cancelBtn.removeEventListener('click',onCancel);
      resolve(result);
    };
    const okBtn=$('confirmDialogOk'), cancelBtn=$('confirmDialogCancel');
    const onOk=()=>cleanup(true), onCancel=()=>cleanup(false);
    okBtn.addEventListener('click',onOk);
    cancelBtn.addEventListener('click',onCancel);
  });
}





function buildOutOfRangeSummaryCompact(){
  const a=currentAnalysis;
  if(!a||!Array.isArray(a.metrics)||!a.metrics.length)return null;
  const bad=a.metrics.filter(m=>m.status==='high'||m.status==='low');
  if(!bad.length)return {lines:[],allNormal:true};
  const lines=bad.map(m=>{
    const rangeTxt=m.normal_range||(isFinite(m.min)&&isFinite(m.max)?`${m.min}-${m.max}`:'n/a');
    return `- ${m.name}: ${metricValueText(m)}${m.unit?' '+m.unit:''} (normal range: ${rangeTxt}) — ${m.status==='high'?'HIGH':'LOW'}`;
  });
  return {lines,allNormal:false};
}
function buildGoogleAIPrompt(keys){
  // Specific values selected (single tap / lasso / "explain all N") -> the rich
  // 3-part structured prompt. buildExplainPrompt already scopes to these keys.
  if(keys&&keys.length){
    return buildExplainPrompt(keys);
  }
  // No selection -> explain everything currently out of range.
  const s=buildOutOfRangeSummaryCompact();
  if(!s)return null;
  if(s.allNormal){
    return 'All my recent lab values are within their normal reference ranges. In simple, reassuring language, explain what it generally means for a panel of common blood tests to all come back normal, and mention 2-3 lifestyle habits that help keep it that way.';
  }
  return 'Explain these lab results in simple, plain language. For EACH value below, cover: (1) what the parameter measures, (2) what it means for it to be high or low, in general terms. Do not guess a diagnosis and do not suggest medications -- focus on plain-language education only.\n\n'+s.lines.join('\n');
}
// Human-readable list of EXACTLY what will be sent to Google, shown in the
// consent dialog so the person can see the precise payload before it leaves.
function googleHandoffValueList(keys){
  const a=currentAnalysis;
  if(!a||!Array.isArray(a.metrics))return '';
  const ms=(keys&&keys.length)
    ? a.metrics.filter(m=>keys.includes(m.key)&&!m.flaggedWrong)
    : a.metrics.filter(m=>m.status==='high'||m.status==='low');
  if(!ms.length)return '';
  return ms.map(m=>{
    const rangeTxt=m.normal_range||(isFinite(m.min)&&isFinite(m.max)?`${m.min}-${m.max}`:'n/a');
    const st=(m.status==='high'||m.status==='low')?` — ${m.status.toUpperCase()}`:'';
    return `• ${m.name}: ${metricValueText(m)}${m.unit?' '+m.unit:''} (range ${rangeTxt})${st}`;
  }).join('\n');
}
// Opens Google Search's AI Mode (the &udm=50 parameter) with the prompt
// pre-filled. This is the ONLY AI path in the app and the ONLY place any data
// can leave the device, so the mandatory per-use opt-in acknowledgment lives
// here -- every entry point (nav, "explain this value", lasso, "explain all")
// funnels through this one function, so all of them are consent-gated.
// &udm=50 is an unofficial, undocumented Google parameter -- stable today but
// not a supported API contract; if Google ever removes it this degrades to a
// normal AI-Overview-enabled search rather than breaking outright. For very long
// prompts a URL risks silent truncation, so past a safe length we copy the
// prompt to the clipboard and open AI Mode blank for the person to paste.
const GOOGLE_AI_URL_SAFE_LEN=8000;
// ─── In-app AI chat ────────────────────────────────────────────────────────────
// Replaces the hand-off to a Google search tab. The model sees a de-identified
// summary (buildChatContext) and at most CHAT_MAX_QUESTIONS questions per report.
// The conversation lives in memory only: it is gone when the report changes or the
// page closes, but the question count is kept so reopening cannot reset it.
const chatState={reportId:null,msgs:[],context:null,started:false,busy:false,error:'',notes:[],seed:null};
const chatEndpoint=()=>'/api/chat';
const chatUsedKey=()=>`chatUsed_${currentUser||'guest'}_${currentAnalysis?currentAnalysis.id:''}`;
const chatUsed=()=>Math.max(0,Number(LS.get(chatUsedKey(),0))||0);
const chatLeft=()=>Math.max(0,CHAT_MAX_QUESTIONS-chatUsed());
// File names often carry the patient's name ("Jane Smith-Female42-1190.pdf") but also ordinary words
// ("test-report.pdf"). Redacting those would rewrite the question and the summary ("this [NAME]"),
// so only the name-like words of a file name are used.
const CHAT_GENERIC_FILE_WORDS=/^(?:test|tests|report|reports|lab|labs|result|results|blood|urine|scan|scans|image|images|photo|photos|pdf|jpg|jpeg|png|copy|final|new|panel|health|analysis|summary|male|female|years?|yrs?|page|file|document|screenshot)$/i;
function chatNames(){
  const p=currentProfile(),a=currentAnalysis||{};
  const fileWords=a.fileName?String(a.fileName).replace(/\.[a-z0-9]+$/i,'').split(/[^A-Za-z]+/).filter(w=>w.length>=3&&!CHAT_GENERIC_FILE_WORDS.test(w)).join(' '):'';
  return [p&&p.name,p&&p.username,a.detectedPatient&&a.detectedPatient.name,fileWords].filter(Boolean);
}
const chatScrub=t=>LabLensDeid.deidentify(t,{names:chatNames()}).text;
function chatRichText(t){
  const inline=s=>esc(s).replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>');
  return String(t).split(/\n{2,}/).map(block=>{
    const lines=block.split('\n').filter(l=>l.trim());
    if(lines.length&&lines.every(l=>/^\s*[-*•]\s+/.test(l)))return '<ul>'+lines.map(l=>`<li>${inline(l.replace(/^\s*[-*•]\s+/,''))}</li>`).join('')+'</ul>';
    return '<p>'+lines.map(inline).join('<br>')+'</p>';
  }).join('');
}
function chatSeedQuestion(keys){
  const a=currentAnalysis;
  const names=(a&&a.metrics||[]).filter(m=>keys.includes(m.key)&&!m.flaggedWrong).map(m=>m.name);
  if(!names.length)return null;
  const shown=names.slice(0,5).join(', ')+(names.length>5?` and ${names.length-5} more`:'');
  return `Explain ${shown} in plain language: what ${names.length>1?'each measures':'it measures'}, where my result stands, and what to ask my doctor.`.slice(0,500);
}
async function openAskAI(keys){
  const a=currentAnalysis;
  if(!a||!Array.isArray(a.metrics)||!a.metrics.length){showToast('Open a report first — there\'s nothing to ask about yet.','info');return}
  // Same switch as AI checking: nothing is sent unless the person has turned it on.
  if(!curationEnabled()){
    const ok=await confirmDialog('Turn on optional AI features?\n\nAsk AI sends a de-identified summary of this report (test names, values, units, ranges and earlier results of the same tests) to an AI service. It never sends your name, age, sex, date of birth, dates or file name. You will see exactly what is sent before the first question. This is the same switch as AI checking, and you can turn it off in Info.');
    if(!ok)return;
    LS.set(CURATE_KEY,true);
    const t=$('curateToggle');if(t)t.checked=true;
  }
  if(chatState.reportId!==String(a.id)){
    Object.assign(chatState,{reportId:String(a.id),msgs:[],started:false,busy:false,error:'',notes:[]});
  }
  const ctx=buildChatContext({analysis:a,history:getHistory(),deid:chatScrub});
  if(!ctx.metricCount){showToast('There are no values to ask about yet.','info');return}
  chatState.context=ctx;
  chatState.seed=keys&&keys.length?chatSeedQuestion(keys):null;
  renderChat();
  const dlg=$('chatSheet');
  if(!dlg.open)dlg.showModal();
  if(chatState.started&&chatState.seed&&chatLeft()>0&&!chatState.busy){const q=chatState.seed;chatState.seed=null;sendChat(q)}
  else setTimeout(()=>{const f=chatState.started?$('chatInput'):$('chatStart');if(f)f.focus()},50);
}
function closeChat(){const d=$('chatSheet');if(d&&d.open)d.close()}
function chatStart(){
  chatState.started=true;
  renderChat();
  const q=chatState.seed;chatState.seed=null;
  if(q&&chatLeft()>0)sendChat(q);else{const f=$('chatInput');if(f)f.focus()}
}
function renderChat(){
  const ctx=chatState.context,left=chatLeft();
  const intro=$('chatIntro'),thread=$('chatThread'),chips=$('chatChips'),form=$('chatForm'),foot=$('chatFoot');
  intro.hidden=chatState.started;
  $('chatSheet').classList.toggle('is-intro',!chatState.started);
  thread.hidden=form.hidden=chips.hidden=foot.hidden=!chatState.started;
  if(!chatState.started){
    $('chatPreview').textContent=ctx?ctx.text:'';
    $('chatPreviewSummary').textContent=ctx?`See exactly what is sent (${ctx.metricCount} value${ctx.metricCount===1?'':'s'}${ctx.trendCount?`, ${ctx.trendCount} with earlier results`:''})`:'See exactly what is sent';
    return;
  }
  const bubbles=chatState.msgs.map(m=>m.role==='user'?`<div class="chat-msg user">${esc(m.text)}</div>`:`<div class="chat-msg ai">${chatRichText(m.text)}</div>`);
  chatState.notes.forEach(n=>bubbles.push(`<div class="chat-msg note">${esc(n)}</div>`));
  if(chatState.busy)bubbles.push('<div class="chat-msg ai" aria-label="AI is writing"><span class="chat-typing"><i></i><i></i><i></i></span></div>');
  if(chatState.error)bubbles.push(`<div class="chat-msg error" role="alert">${esc(chatState.error)}${chatState.fallback?'<br><button class="btn-secondary" type="button" onclick="chatUseGoogle()">Open in Google AI search instead</button>':''}</div>`);
  if(!chatState.msgs.length&&!chatState.busy&&left>0)bubbles.unshift('<div class="chat-msg ai"><p>Hi! Ask me about the results in this report. I explain what they mean in plain language, but I can’t diagnose.</p></div>');
  thread.innerHTML=bubbles.join('');
  thread.scrollTop=thread.scrollHeight;
  const suggestions=!chatState.msgs.length&&!chatState.busy&&left>0
    ?['What is out of range?',...(ctx&&ctx.trendCount?['How have my results changed?']:[]),'What should I ask my doctor?']:[];
  chips.hidden=!suggestions.length;
  chips.innerHTML=suggestions.map(q=>`<button class="chat-chip" type="button" data-q="${esc(q)}">${esc(q)}</button>`).join('');
  form.hidden=left<=0;
  $('chatSend').disabled=chatState.busy;
  $('chatInput').disabled=chatState.busy;
  foot.textContent=left>0
    ?`${left} of ${CHAT_MAX_QUESTIONS} questions left for this report · AI can make mistakes. Not medical advice.`
    :`You’ve used all ${CHAT_MAX_QUESTIONS} questions for this report. Not medical advice; talk to your clinician about anything that worries you.`;
}
function chatUseGoogle(){closeChat();explainWithGoogleAI(null)}
async function sendChat(raw){
  const a=currentAnalysis;
  if(chatState.busy||!a||String(a.id)!==chatState.reportId||!chatState.started)return;
  if(chatLeft()<=0){renderChat();return}
  const typed=String(raw||'').trim().slice(0,500);
  if(!typed)return;
  const q=chatScrub(typed).trim();
  if(!q){chatState.error='Please ask without names or contact details.';chatState.fallback=false;renderChat();return}
  chatState.notes=q!==typed?['Personal details were removed from your question before sending.']:[];
  chatState.error='';chatState.fallback=false;chatState.busy=true;
  chatState.msgs.push({role:'user',text:q});
  const input=$('chatInput');if(input){input.value='';input.style.height=''}
  renderChat();
  try{
    const res=await fetch(chatEndpoint(),{method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({context:chatState.context.text,messages:chatState.msgs.map(m=>({role:m.role,text:m.text}))}),signal:AbortSignal.timeout(30000)});
    if(!res.ok){const e=new Error('chat '+res.status);e.status=res.status;throw e}
    const data=await res.json();
    if(String(currentAnalysis&&currentAnalysis.id)!==chatState.reportId)return;
    chatState.msgs.push({role:'model',text:String(data.reply||'').trim()||'Sorry, I could not answer that.'});
    LS.set(chatUsedKey(),chatUsed()+1);
  }catch(e){
    // A failed question is not counted: take it back out and return the text to the box.
    chatState.msgs.pop();
    if(input)input.value=typed;
    chatState.fallback=e&&e.status===503;
    chatState.error=e&&e.status===503?'Ask AI is not set up here.'
      :e&&e.status===429?'Too many questions right now. Please try again in a little while.'
      :e&&e.status===422?'That question included details that could not be sent safely. Please rephrase it.'
      :'Couldn’t reach the AI service. Your question was not counted, so you can try again.';
  }finally{
    chatState.busy=false;
    renderChat();
    const f=$('chatInput');if(f&&!f.disabled&&!f.closest('[hidden]'))f.focus();
  }
}
function wireChat(){
  const form=$('chatForm'),input=$('chatInput'),dlg=$('chatSheet');
  if(!form||!input||!dlg)return;
  form.addEventListener('submit',e=>{e.preventDefault();sendChat(input.value)});
  input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();sendChat(input.value)}});
  input.addEventListener('input',()=>{input.style.height='auto';input.style.height=Math.min(input.scrollHeight,120)+'px'});
  $('chatChips').addEventListener('click',e=>{const b=e.target.closest('.chat-chip');if(b)sendChat(b.dataset.q)});
  dlg.addEventListener('click',e=>{if(e.target===dlg)dlg.close()});
}

async function explainWithGoogleAI(keys){
  const prompt=buildGoogleAIPrompt(keys);
  if(!prompt){ showToast('Open a report first — there\'s nothing to explain yet.','info'); return; }
  // MANDATORY opt-in, every time, on every device. No silent handoff.
  const sent=googleHandoffValueList(keys);
  const consent=
    'This opens an AI assistant in a NEW TAB and sends the following to it:\n\n'+
    (sent||'(a general question about your results — no specific values)')+
    '\n\nNOT sent: your name, age, sex, date of birth, or file name.\n\n'+
    'This leaves LabLens and is NOT private the way the rest of the app is. Continue?';
  const ok=await confirmDialog(consent);
  if(!ok)return;
  const encoded=encodeURIComponent(prompt);
  const url='https://www.google.com/search?q='+encoded+'&udm=50';
  if(encoded.length<=GOOGLE_AI_URL_SAFE_LEN){
    window.open(url,'_blank','noopener');
    return;
  }
  // Prompt is extremely long — show a copy-able box so the user can paste it manually.
  showPromptCopyModal(prompt, 'https://www.google.com/search?q=health+ai&udm=50');
}
function showPromptCopyModal(prompt, targetUrl){
  const destUrl = targetUrl || 'https://gemini.google.com';
  const old=document.getElementById('promptCopyModal');
  if(old)old.remove();
  const overlay=document.createElement('div');
  overlay.id='promptCopyModal';
  overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:300;display:flex;align-items:center;justify-content:center;padding:16px';
  const safePrompt=prompt.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  overlay.innerHTML=`
    <div style="background:var(--card);border-radius:16px;padding:24px;max-width:540px;width:100%;box-shadow:var(--shadow-lg);max-height:90vh;display:flex;flex-direction:column;gap:14px">
      <h4 style="margin:0;font-size:15px">Prompt ready — open the AI assistant and paste</h4>
      <p style="margin:0;font-size:12.5px;color:var(--text-secondary);line-height:1.5">Your prompt is too long for a URL (${prompt.length} characters). Copy it below, then open the AI assistant and paste it in.</p>
      <textarea id="promptCopyTA" readonly style="flex:1;min-height:180px;max-height:340px;font-size:12px;line-height:1.55;padding:12px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);resize:vertical;font-family:inherit">${safePrompt}</textarea>
      <div style="display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap">
        <button class="btn-secondary" onclick="document.getElementById('promptCopyModal').remove()">Cancel</button>
        <button class="btn-primary" id="copyPromptBtn" onclick="(function(btn){const ta=document.getElementById('promptCopyTA');ta.select();try{navigator.clipboard.writeText(ta.value).then(()=>{btn.textContent='Copied';setTimeout(()=>btn.textContent='Copy prompt',2000)}).catch(()=>{document.execCommand('copy');btn.textContent='Copied';setTimeout(()=>btn.textContent='Copy prompt',2000)})}catch(e){document.execCommand('copy');btn.textContent='Copied';setTimeout(()=>btn.textContent='Copy prompt',2000)}})(this)">Copy prompt</button>
        <button class="btn-primary" onclick="window.open('${destUrl}','_blank','noopener')">Open AI assistant →</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.remove();});
  setTimeout(()=>{const ta=document.getElementById('promptCopyTA');if(ta)ta.select();},100);
}
// The former on-device chat modal is gone. Every AI affordance in the app now
// routes here: the nav "AI" item calls openAIChat() (explains everything out of
// range); per-value/lasso/filter buttons call explainWithGoogleAI(keys). Both
// go through the consent gate above.



// [removed] retryOnCPU -- on-device CPU fallback for the local model.











const NAV_BUTTONS=[
  {key:'new',label:'New report',icon:'plus'},
  {key:'current',label:'Current',icon:'file'},
  {key:'trends',label:'Trends',icon:'trends'},
  {key:'history',label:'History',icon:'history'},
  {key:'info',label:'Info',icon:'info'}
];
let activeNavKey='new';

function setActiveNav(key){
  activeNavKey=key;
  document.querySelectorAll('#headerNav .nav-btn').forEach(btn=>{
    const active=btn.dataset.nav===key;
    btn.classList.toggle('active',active);
    if(active)btn.setAttribute('aria-current','page');else btn.removeAttribute('aria-current');
  });
}

function renderNav(){
  const nav=$('headerNav'); if(!nav)return;
  nav.innerHTML='';
  for(const b of NAV_BUTTONS){
    const btn=document.createElement('button');
    btn.className='nav-btn';
    btn.dataset.nav=b.key;
    btn.innerHTML=`<svg class="icn" aria-hidden="true" focusable="false"><use href="#i-${b.icon||'file'}"/></svg><span>${b.label}</span>`;
    const historyCount=getHistory().length;
    if(b.key==='current')btn.disabled=!currentAnalysis&&!historyCount;
    if(b.key==='trends')btn.disabled=!currentAnalysis&&historyCount<2;
    btn.addEventListener('click',()=>{
      try{
        if(b.key==='new') resetAll();
        else if(b.key==='current') showCurrentAnalysis();
        else if(b.key==='trends') showTrends();
        else if(b.key==='history') showHistory();
        else if(b.key==='info') showInfo();
      }catch(err){console.warn('nav action failed',err)}
    });
    nav.appendChild(btn);
  }
  setActiveNav(activeNavKey);
}

function showTrends(){hideInfo();
  if(!currentAnalysis){
    const latest=getHistory().slice().sort((a,b)=>new Date(b.date)-new Date(a.date))[0];
    if(!latest){showToast('Add at least two dated reports to view trends','info');return;}
    currentAnalysis=latest;
    displayResults(latest);
  }
  $('uploadSection').style.display='none';
  $('historySection').style.display='none';
  $('resultsSection').classList.add('active');
  switchTab('comparison');
  setActiveNav('trends');
  window.scrollTo({top:0,behavior:'smooth'});
}

async function deleteAllData(){
  const ok=await confirmDialog('Delete every profile and report stored in this browser?\n\nThis cannot be undone. Download a backup first if you may need them.');
  if(!ok)return;
  try{
    const drop=[];
    for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(/^(health|lablens_|currentUser|currentAnalysisId_|defaultTrendKey_|uploadCategory_|historyView)/.test(k))drop.push(k)}
    drop.forEach(k=>localStorage.removeItem(k));
  }catch(e){console.warn('delete failed',e)}
  location.reload();
}
/* === LOCAL DATA BACKUP & RESTORE (JSON WORKSPACE) === */
function buildBackupData(){
  const data={
    version:'1.1.0',exportDate:new Date().toISOString(),
    users:LS.get('healthUsers',[]),currentUser:LS.get('currentUser',null),theme:LS.get('healthTheme','light'),
    reports:Object.create(null),medications:Object.create(null),medicationLogs:Object.create(null),
    uploadCategories:Object.create(null),defaultTrendKeys:Object.create(null),currentAnalysisIds:Object.create(null)
  };
  for(const prefix of ['guest',...data.users.map(u=>u.username)]){
    data.reports[prefix]=LS.get(`health_reports_${prefix}`,[]);
    data.medications[prefix]=LS.get(`health_meds_${prefix}`,[]);
    data.medicationLogs[prefix]=LS.get(`health_medlog_${prefix}`,[]);
    data.uploadCategories[prefix]=LS.get(`uploadCategory_${prefix}`,'auto');
    data.defaultTrendKeys[prefix]=LS.get(`defaultTrendKey_${prefix}`,null);
    data.currentAnalysisIds[prefix]=LS.get(`currentAnalysisId_${prefix}`,null);
  }
  return data;
}
function downloadBackupData(data,name){
  const blob=new Blob([JSON.stringify(data)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  try{
    const anchor=document.createElement('a');
    anchor.href=url;anchor.download=name;document.body.appendChild(anchor);anchor.click();anchor.remove();
  }finally{setTimeout(()=>URL.revokeObjectURL(url),60000)}
}
async function exportBackup() {
  if(!await confirmDialog('Download an unencrypted backup of all profiles, reports, and medication records? Anyone who opens the file can read the medical details. Store it somewhere private.'))return;
  try {
    downloadBackupData(buildBackupData(),`LabLens_Backup_${new Date().toISOString().slice(0,10)}.json`);
    showToast('Backup download started. Check that the file was saved before relying on it.','success');
  } catch (err) {
    console.error('Failed to export backup:', err);
    showToast('Failed to generate backup: ' + (err && err.message), 'error');
  }
}

function openBackupPicker(){$('backupInput').click()}
function importBackup(file) {
  if (!file) return;
  if(file.size>50*1024*1024){showToast('Backup is too large to import (50 MB maximum).','error');return}
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (!data || !['1.0.0','1.1.0'].includes(data.version) || !Array.isArray(data.users) || data.users.length>100) {
        throw new Error("Invalid or corrupted LabLens backup file.");
      }
      const importedUsers=data.users.map(u=>{
        if(!u||typeof u!=='object'||Array.isArray(u))throw new Error('Backup contains an invalid profile.');
        const username=safeText(u.username,80).trim();
        if(!username||/[\u0000-\u001f\u007f]/.test(username))throw new Error('Backup contains an invalid profile name.');
        return {username,nickname:safeText(u.nickname||username,80),sex:safeText(u.sex,30),dob:safeText(u.dob,20),createdAt:safeText(u.createdAt,40)};
      });
      const userNames=new Set();
      for(const user of importedUsers){const key=user.username.toLocaleLowerCase();if(userNames.has(key))throw new Error('Backup contains duplicate profile names.');userNames.add(key)}
      const importedPrefixes=['guest',...importedUsers.map(u=>u.username)];
      if(data.reports!=null&&(typeof data.reports!=='object'||Array.isArray(data.reports)))throw new Error('Backup report data is invalid.');
      const importedReports=Object.create(null);
      let totalImportedReports=0;
      for(const prefix of importedPrefixes){
        const rows=data.reports&&Object.prototype.hasOwnProperty.call(data.reports,prefix)?data.reports[prefix]:[];
        if(!Array.isArray(rows)||rows.length>2000||totalImportedReports+rows.length>5000)throw new Error('Backup contains too many or invalid reports.');
        totalImportedReports+=rows.length;
        importedReports[prefix]=rows.map((row,i)=>{
          const clean=normalizeAnalysisRecord(row,i);
          if(!clean)throw new Error('Backup contains an invalid report.');
          return clean;
        });
      }
      const validCurrentUser=typeof data.currentUser==='string'&&(data.currentUser===''||data.currentUser==='guest'||importedUsers.some(u=>u.username===data.currentUser))?data.currentUser:null;
      const validTheme=data.theme==='dark'?'dark':'light';
      const categoryFor=prefix=>['auto','lab','other','prescription'].includes(data.uploadCategories?.[prefix])?data.uploadCategories[prefix]:'auto';
      const trendKeyFor=prefix=>SAFE_METRIC_KEY.test(safeText(data.defaultTrendKeys?.[prefix],120))?data.defaultTrendKeys[prefix]:null;
      const currentIdFor=prefix=>{const id=data.currentAnalysisIds?.[prefix];return typeof id==='string'&&id.length<=120?id:null};
      const importedMeds=Object.create(null),importedMedLogs=Object.create(null);
      if(data.version==='1.1.0'){
        if(!data.medications||typeof data.medications!=='object'||Array.isArray(data.medications)||!data.medicationLogs||typeof data.medicationLogs!=='object'||Array.isArray(data.medicationLogs))throw new Error('Backup is missing medication records.');
        for(const prefix of importedPrefixes){
          if(!Object.prototype.hasOwnProperty.call(data.medications,prefix)||!Object.prototype.hasOwnProperty.call(data.medicationLogs,prefix))throw new Error('Backup is missing medication records.');
          const meds=data.medications[prefix],logs=data.medicationLogs[prefix];
          if(!Array.isArray(meds)||!Array.isArray(logs)||meds.length>5000||logs.length>20000)throw new Error('Backup contains invalid medication records.');
          importedMeds[prefix]=meds;importedMedLogs[prefix]=logs;
        }
      }

      const legacyNote=data.version==='1.0.0'?' This older backup has no medication records; those already on this device will be kept.':'';
      const confirmRestore = await confirmDialog(`Restore data from this backup? This will overwrite your current local records.${legacyNote} A separate unencrypted recovery backup of your current records will download first; keep it somewhere private.`);
      if (!confirmRestore) return;
      downloadBackupData(buildBackupData(),`LabLens_PreRestore_${new Date().toISOString().replace(/[:.]/g,'-')}.json`);

      const oldUsers=LS.get('healthUsers',[]);
      const affectedPrefixes=new Set(['guest',...(Array.isArray(oldUsers)?oldUsers.map(u=>u?.username).filter(x=>typeof x==='string'):[]),...importedPrefixes]);
      const managedKeys=new Set(['healthUsers','healthTheme','currentUser']);
      for(const prefix of affectedPrefixes){
        for(const keyPrefix of USER_KEY_PREFIXES){
          if(data.version==='1.0.0'&&/^health_(?:meds|medlog)_$/.test(keyPrefix))continue;
          managedKeys.add(keyPrefix+prefix);
        }
      }
      const shouldClear=key=>managedKeys.has(key);
      const previous={};
      for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(shouldClear(key))previous[key]=localStorage.getItem(key)}
      const clearManaged=()=>{const keys=Array.from({length:localStorage.length},(_,i)=>localStorage.key(i));for(const key of keys)if(shouldClear(key))localStorage.removeItem(key)};
      const write=(key,value)=>{if(!LS.set(key,value))throw new Error('Browser storage is full; the backup could not be restored.')};
      try{
      clearManaged();
      write('healthUsers', importedUsers);
      write('currentUser', validCurrentUser);
      write('healthTheme', validTheme);

      importedPrefixes.forEach(prefix=>{
        write(`health_reports_${prefix}`,importedReports[prefix]);
        write(`uploadCategory_${prefix}`,categoryFor(prefix));
        write(`defaultTrendKey_${prefix}`,trendKeyFor(prefix));
        write(`currentAnalysisId_${prefix}`,currentIdFor(prefix));
        if(data.version==='1.1.0'){
          write(`health_meds_${prefix}`,importedMeds[prefix]);
          write(`health_medlog_${prefix}`,importedMedLogs[prefix]);
        }
      });
      }catch(writeError){
        let rollbackFailed=false;
        try{clearManaged();for(const [key,value] of Object.entries(previous))localStorage.setItem(key,value)}catch{rollbackFailed=true}
        throw new Error(rollbackFailed?'Restore failed and some previous records could not be put back. Import the downloaded PreRestore backup.':`${writeError.message} Your previous records were put back. Keep the downloaded PreRestore backup until you verify them.`);
      }

      showToast('Backup successfully restored! Reloading app...', 'success');
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err) {
      console.error('Failed to import backup:', err);
      showToast('Failed to restore backup: ' + (err && err.message), 'error');
    }
  };
  reader.onerror=()=>showToast('Could not read the backup file.','error');
  reader.readAsText(file);
}

function populateCategoryUI(){
  const sel=$('uploadCatSelect');
  if(sel)sel.innerHTML = CATS.map(c=>`<option value="${c.key}">${c.icon} ${esc(c.label)}</option>`).join('');
  const grid = $("supportedTypesGrid");
  if(grid)grid.innerHTML = CATS.filter(c=>c.key!=='other').map(c=>`<div class="test-pill">${c.icon} ${esc(c.label)}</div>`).join('');
}

if(document.fonts&&document.fonts.ready)document.fonts.ready.then(()=>fitProfileSelect());
window.addEventListener('resize',()=>fitProfileSelect());
async function init(){
  try{const _t=new Date().toISOString().slice(0,10);["newUserDob","idNewDob","gpDob"].forEach(i=>{const e=document.getElementById(i);if(e)e.max=_t})}catch{}
  try{const _c=$('curateToggle');if(_c)_c.checked=curationEnabled()}catch{}
  // --- Restore theme (attribute only; icon is updated after nav renders) ---
  const theme=LS.get('healthTheme',null);if(theme)document.documentElement.setAttribute('data-theme',theme);
  // --- Restore users & last-selected user ---
  users=LS.get('healthUsers',[]);if(!Array.isArray(users))users=[];
  renderUserSelect();
  const saved=LS.get('currentUser',null);
  if(saved&&users.some(u=>u.username===saved)){
    currentUser=saved;$('userSelect').value=saved;
  }else if(users.length===0){
    currentUser=null;LS.del('currentUser');
  }else{
    currentUser=users[0].username;$('userSelect').value=currentUser;LS.set('currentUser',currentUser);
  }
  renderUserSelect();renderUserBadge();updateUserInfoDisplay();
  // --- Build modular nav (so #themeIcon exists in DOM) ---
  renderNav();
  updateThemeIcon();
  try{renderRecents()}catch{}
  // --- Restore UI preferences ---
  const cat=LS.get('uploadCategory_'+(currentUser||'guest'),null);
  if(cat){uploadCategory=cat;setUploadCategory(cat);const sel=$('uploadCatSelect');if(sel)sel.value=cat;}
  selectedTrendKey=defaultTrendKey=LS.get('defaultTrendKey_'+(currentUser||'guest'),null);
  if(LS.get('historyView'))historyView=LS.get('historyView','cards');
  // --- Rebuild the "coming up" strip from saved follow-ups ---
  try{renderUpcoming()}catch(e){}
  // --- Restore last-viewed analysis (if available) ---
  try{
    const lastId=LS.get('currentAnalysisId_'+(currentUser||'guest'),null);
    if(lastId){
      const h=getHistory();
      const r=h.find(x=>String(x.id)===String(lastId));
      if(r){currentAnalysis=r;}
    }
  }catch(e){}
  populateCategoryUI();wireUpload();wireUploadFit();wireChat();
  // (no first-run modal: a profile is offered after the first report is read)
  // Note: persistence is handled by LS helper on every change (users, history,
  // meds, med-log, theme, default-trend, AI model selection). On page close
  // everything is already in localStorage, so reload will restore it.
}

function openFeedbackModal(prefillMessage){
  $('feedbackModal').classList.add('active');
  if(prefillMessage)$('fbMessage').value=prefillMessage;
  setTimeout(()=>$('fbEmail').focus(),50);
}
function closeFeedbackModal(){
  $('feedbackModal').classList.remove('active');
  $('feedbackForm').reset();
}
function sendFeedback(e){
  e.preventDefault();
  const email=$('fbEmail').value.trim();
  const message=$('fbMessage').value.trim();
  if(!email||!message)return;
  if(message.length>2000){showToast('Please keep feedback under 2,000 characters.','error');return;}
  const body=encodeURIComponent(`Reply email: ${email}\n\n${message}`);
  const href=`mailto:lablens.support@gmail.com?subject=${encodeURIComponent('LabLens feedback')}&body=${body}`;
  const link=document.createElement('a');
  link.href=href;link.target='_blank';link.rel='noopener';link.hidden=true;
  document.body.appendChild(link);link.click();link.remove();
  closeFeedbackModal();
  showToast('Email draft opened. Review it and tap Send in your email app.','success');
}
/* ================= DIALOG ACCESSIBILITY =================
   Every overlay gets dialog semantics, focus moves in on open and back on
   close, Tab stays inside, and Escape / a click on the backdrop dismisses it
   through the dialog's own cancel or close control so pending promises settle. */
(function wireOverlays(){
  const FOCUSABLE='a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  const returnTo=new WeakMap();
  const panel=o=>o.querySelector('.modal,.metric-sheet');
  document.querySelectorAll('.modal-overlay').forEach(o=>{
    const p=panel(o); if(!p)return;
    p.setAttribute('role','dialog');p.setAttribute('aria-modal','true');
    const h=p.querySelector('h3,h2');
    if(h){if(!h.id)h.id=(o.id||'overlay')+'Title';p.setAttribute('aria-labelledby',h.id)}else p.setAttribute('aria-label','Details');
    new MutationObserver(()=>{
      if(o.classList.contains('active')){
        returnTo.set(o,document.activeElement);
        requestAnimationFrame(()=>{const t=p.querySelector('[autofocus]')||p.querySelector(FOCUSABLE);if(t)t.focus({preventScroll:true})});
      }else{
        const r=returnTo.get(o);if(r&&r.focus&&document.contains(r))r.focus({preventScroll:true});returnTo.delete(o);
      }
    }).observe(o,{attributes:true,attributeFilter:['class']});
  });
  function dismiss(o){
    const btn=o.querySelector('[data-dismiss],.sheet-close,.btn-secondary,#confirmDialogCancel');
    if(btn)btn.click();else o.classList.remove('active');
  }
  document.addEventListener('keydown',e=>{
    const open=[...document.querySelectorAll('.modal-overlay.active')].pop();
    if(!open)return;
    if(e.key==='Escape'){e.preventDefault();dismiss(open);return}
    if(e.key==='Tab'){
      const f=[...panel(open).querySelectorAll(FOCUSABLE)].filter(x=>x.offsetParent!==null);
      if(!f.length)return;
      const first=f[0],last=f[f.length-1];
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
    }
  });
  document.addEventListener('mousedown',e=>{
    const o=e.target;
    if(o.classList&&o.classList.contains('modal-overlay')&&o.classList.contains('active')&&(o.id==='metricSheetOverlay'||o.id==='confirmDialogOverlay'))dismiss(o);
  });
})();
Object.assign(window,{printDoctorSummary,editCurrentProfile,openAskAI,closeChat,chatStart,chatUseGoogle,fitProfileSelect,editProfileFromList,deleteProfile,openEditUserModal,onProfileSelect,addAnotherPage,showInfo,guestProfileSave,guestProfileSkip,deleteAllData,setCuration,showLastCuration,showHome,resetAll,showHistory,toggleTheme,openAddUserModal,closeAddUserModal,addUser,switchUser,logoutUser,removeFile,clearAllFiles,overrideImageQuality,setGroupMode,setUploadCategory,analyzeReport,switchTab,handleResultTabKey,loadHistoryReport,openHistoryItem,deleteHistoryItem,clearHistory,printResults,setHistoryFilter,addTagFromInput,removeTag,onNoteInput,setTrendParam,setTrendRange,setTrendView,setTrendFilter,setTrendQuery,trendTip,setDefaultTrendParam,clearDefaultTrendParam,showCurrentAnalysis,changeReportCategory,toggleProv,flagMetric,confirmMetric,setHistoryView,initMedViewer,medZoom,medReset,medRotate,medInvert,medRedraw,idAnswerYes,idAnswerNew,idAnswerSkip,idCancelClarify,idConfirmClarify,idPickField,idCancelNew,idCreateNewProfile,closeIdentityModal,renderNav,setMetricsFilter,openMetricSheet,closeMetricSheet,metricSheetPick,toggleSheetProv,flagMetricByKey,renderMetricCorrection,saveMetricCorrection,setOriginalView,copyOriginalText,onDocPageImgLoad,onDocHitTap,explainMetricsNow,explainWithGoogleAI,openFeedbackModal,closeFeedbackModal,sendFeedback,showTrends,exportBackup,openBackupPicker,importBackup,getOcrDiagnostics});if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();

// ---- PWA: register the service worker ----
// Only runs on a real http(s) origin — service workers are unavailable (and
// this call fails silently) on file://, which is fine: the app still works
// there, it just won't be installable or offline-capable until it's hosted.
if('serviceWorker' in navigator && location.protocol.startsWith('http')){
   navigator.serviceWorker.register('./service-worker.js')
   .then(reg=>{
     console.log('Service worker registered:',reg.scope);
     reg.addEventListener('updatefound',()=>{
       const newWorker=reg.installing;
       if(newWorker){
         newWorker.addEventListener('statechange',()=>{
           if(newWorker.state==='installed' && navigator.serviceWorker.controller){
             console.log('[PWA] New version update found on Netlify! Updating instantly...');
             newWorker.postMessage({action:'skipWaiting'});
           }
         });
       }
     });
   })
   .catch(err=>console.warn('Service worker registration failed (app still works normally):',err));

   let refreshing=false;
   navigator.serviceWorker.addEventListener('controllerchange',()=>{
     if(refreshing)return;
     refreshing=true;
     window.location.reload();
   });

   // Force immediate update check on load and foreground focus (essential for iOS PWA updates!)
   const checkUpdate = () => {
     navigator.serviceWorker.getRegistration().then(reg => {
       if (reg) {
         console.log('[PWA] Querying Netlify for updates...');
         reg.update();
       }
     });
   };
   checkUpdate();
   document.addEventListener('visibilitychange', () => {
     if (document.visibilityState === 'visible') checkUpdate();
   });
}
})();
