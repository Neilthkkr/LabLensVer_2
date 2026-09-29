#!/usr/bin/env node
// Developer probe for the Gemini curation path. Extracts text from a PDF with the
// vendored PDF.js + app row reconstruction, de-identifies it exactly as the app does,
// calls netlify/functions/curate.mjs (needs GEMINI_API_KEY in the environment) and
// compares the curated rows with the on-device parser. Prints the de-identified text
// that would be sent; nothing is written to disk.
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
console.log=(...a)=>console.error(...a);
const input=process.argv[2];
if(!input)throw new Error('Usage: GEMINI_API_KEY=... node scripts/probe-curation.mjs <report.pdf>');
const require=createRequire(import.meta.url);
const pdfjs=require('../vendor/pdfjs/pdf.min.js');
pdfjs.GlobalWorkerOptions.workerSrc=new URL('../vendor/pdfjs/pdf.worker.min.js',import.meta.url).pathname;
const {deidentify,demographics}=require('../src/privacy/deidentify.js');
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const cut=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
const ctx={console};vm.createContext(ctx);
vm.runInContext([
  cut('const STANDARD_RANGES =','\nconst LS='),
  cut('function reconstructPdfLines(items)','\n// §6:'),
  html.match(/^function normText[^\n]*$/m)[0],
  cut('function parseLooseDate','function nameSimilarity'),
  cut('function extractPatientIdentity','function parseLooseDate'),
  cut('function curatedRowsToMetrics','// One entry point for every analysis path'),
  'this.api={parse:parseReportText,rows:reconstructPdfLines,ident:extractPatientIdentity,map:curatedRowsToMetrics};'
].join('\n'),ctx);
const pdf=await pdfjs.getDocument({data:new Uint8Array(fs.readFileSync(input)),disableWorker:true}).promise;
let text='';
for(let n=1;n<=pdf.numPages;n++){const c=await (await pdf.getPage(n)).getTextContent();text+=ctx.api.rows(c.items).replace(/\0/g,'-')+'\n'}
const idn=ctx.api.ident(text,input);
const demo=demographics(idn.age,idn.sex);
const d=deidentify(text,{names:[idn.nameRaw,idn.name]});
console.error('--- de-identified text sent ---\n'+d.text+'\n--- demographics:',JSON.stringify(demo),'stats:',JSON.stringify(d.stats));
const local=ctx.api.parse(text,{sex:demo.sex,age:demo.age});
const {default:handler}=await import('../netlify/functions/curate.mjs');
const res=await handler(new Request('http://x/api/curate',{method:'POST',body:JSON.stringify({text:d.text,age:demo.age,sex:demo.sex})}));
const body=await res.json();
if(res.status!==200){console.error('function returned',res.status,JSON.stringify(body));process.exit(1)}
const curated=ctx.api.map(body.parameters,d.text,text,{sex:demo.sex,age:demo.age});
const key=m=>m.key;
const L=new Set(local.map(key)),G=new Set(curated.map(key));
process.stdout.write(JSON.stringify({isLabReport:body.isLabReport,returned:body.parameters.length,accepted:curated.length,rejectedByGuard:curated.dropped,local:local.length,onlyGemini:[...G].filter(k=>!L.has(k)),onlyLocal:[...L].filter(k=>!G.has(k)),curated:curated.map(m=>[m.name,m.value,m.unit,m.normal_range,m.status])},null,1)+'\n');
