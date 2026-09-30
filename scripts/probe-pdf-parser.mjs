#!/usr/bin/env node
// Developer-only end-to-end probe for digital PDFs. Uses the same vendored
// PDF.js build, row reconstruction, and parser as the browser app. Results are
// printed to stdout only; neither source text nor patient data is persisted.
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {parseReportText} from '../src/core/lab-parser.mjs';

// PDF.js reports recoverable font warnings through console.log. Keep stdout
// machine-readable so this probe can be used safely by batch audit scripts.
console.log=(...args)=>console.error(...args);

const input=process.argv[2];
if(!input)throw new Error('Usage: node scripts/probe-pdf-parser.mjs <report.pdf>');
const require=createRequire(import.meta.url);
const pdfjs=require('../vendor/pdfjs/pdf.min.js');
pdfjs.GlobalWorkerOptions.workerSrc=new URL('../vendor/pdfjs/pdf.worker.min.js',import.meta.url).pathname;
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const source=html+'\n'+app;
const rowStart=source.indexOf('function reconstructPdfLines(items)');
const rowEnd=source.indexOf('\n// §6:',rowStart);
if(rowStart<0||rowEnd<=rowStart){
  throw new Error('PDF row reconstruction source was not found');
}
const context={console};
vm.createContext(context);
vm.runInContext(`${source.slice(rowStart,rowEnd)}\nthis.__rows=reconstructPdfLines;`,context);

const bytes=new Uint8Array(fs.readFileSync(input));
const pdf=await pdfjs.getDocument({data:bytes,disableWorker:true}).promise;
let text='';
const pageTextChars=[];
for(let pageNumber=1;pageNumber<=pdf.numPages;pageNumber++){
  const page=await pdf.getPage(pageNumber);
  const content=await page.getTextContent();
  const pageText=context.__rows(content.items).replace(/\0/g,'-');
  pageTextChars.push(pageText.replace(/\s/g,'').length);
  text+=pageText+'\n';
}
const metrics=parseReportText(text,{sex:null,age:null});
if(process.argv.includes('--text'))process.stdout.write(text);
else process.stdout.write(JSON.stringify({
  pages:pdf.numPages,
  textChars:text.replace(/\s/g,'').length,
  pageTextChars,
  scannedPageCount:pageTextChars.filter(chars=>chars<12).length,
  metrics
},null,2)+'\n');
