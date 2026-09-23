#!/usr/bin/env node
// Developer-only end-to-end probe for digital PDFs. Uses the same vendored
// PDF.js build, row reconstruction, and parser as the browser app. Results are
// printed to stdout only; neither source text nor patient data is persisted.
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';

const input=process.argv[2];
if(!input)throw new Error('Usage: node scripts/probe-pdf-parser.mjs <report.pdf>');
const require=createRequire(import.meta.url);
const pdfjs=require('../vendor/pdfjs/pdf.min.js');
pdfjs.GlobalWorkerOptions.workerSrc=new URL('../vendor/pdfjs/pdf.worker.min.js',import.meta.url).pathname;
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const parserStart=html.indexOf('const STANDARD_RANGES =');
const parserEnd=html.indexOf('\nconst LS=',parserStart);
const rowStart=html.indexOf('function reconstructPdfLines(items)');
const rowEnd=html.indexOf('\n// §6:',rowStart);
if(parserStart<0||parserEnd<=parserStart||rowStart<0||rowEnd<=rowStart){
  throw new Error('Embedded PDF parser source was not found');
}
const context={console};
vm.createContext(context);
vm.runInContext(`${html.slice(parserStart,parserEnd)}\n${html.slice(rowStart,rowEnd)}\nthis.__parse=parseReportText;this.__rows=reconstructPdfLines;`,context);

const bytes=new Uint8Array(fs.readFileSync(input));
const pdf=await pdfjs.getDocument({data:bytes,disableWorker:true}).promise;
let text='';
for(let pageNumber=1;pageNumber<=pdf.numPages;pageNumber++){
  const page=await pdf.getPage(pageNumber);
  const content=await page.getTextContent();
  text+=context.__rows(content.items).replace(/\0/g,'-')+'\n';
}
const metrics=context.__parse(text,{sex:null,age:null});
if(process.argv.includes('--text'))process.stdout.write(text);
else process.stdout.write(JSON.stringify({pages:pdf.numPages,metrics},null,2)+'\n');
