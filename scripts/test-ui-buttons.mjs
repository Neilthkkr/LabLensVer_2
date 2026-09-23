#!/usr/bin/env node
// Browser-level UI smoke test for LabLens. Runs against a disposable Chrome
// profile and local HTTP server; no report data or browser state is retained.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import os from 'node:os';
import {spawn} from 'node:child_process';

const root=path.resolve(new URL('..',import.meta.url).pathname);
const chrome='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
if(!fs.existsSync(chrome))throw new Error(`Chrome not found at ${chrome}`);
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webmanifest':'application/manifest+json'};
const server=http.createServer((req,res)=>{
  const requestPath=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  // The production service worker can legitimately claim and reload a first-time
  // page while this test is clicking it. Keep the UI run deterministic; the
  // service worker's network-first behavior is covered by the unit suite.
  if(requestPath==='/service-worker.js'){res.writeHead(404);res.end('Disabled in UI test');return}
  const rel=requestPath==='/'?'index.html':requestPath.replace(/^\/+/, '');
  const file=path.resolve(root,rel);
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end('Not found');return}
  res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});
  fs.createReadStream(file).pipe(res);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const appPort=server.address().port,debugPort=9300+Math.floor(Math.random()*300);
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'lablens-ui-'));
const browser=spawn(chrome,[
  '--headless=new',`--remote-debugging-port=${debugPort}`,`--user-data-dir=${profile}`,
  '--no-first-run','--no-default-browser-check','--disable-gpu','--disable-background-networking',
  `http://127.0.0.1:${appPort}/`
],{stdio:'ignore'});

const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let ws;
try{
  let target;
  for(let i=0;i<80;i++){
    try{const pages=await fetch(`http://127.0.0.1:${debugPort}/json/list`).then(r=>r.json());target=pages.find(p=>p.type==='page');if(target)break}catch{}
    await wait(100);
  }
  if(!target)throw new Error('Chrome DevTools target did not become available');
  ws=new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true})});
  let seq=0;const pending=new Map();
  ws.addEventListener('message',event=>{const msg=JSON.parse(event.data);if(!msg.id)return;const p=pending.get(msg.id);if(!p)return;pending.delete(msg.id);msg.error?p.reject(new Error(msg.error.message)):p.resolve(msg.result)});
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}))});
  await send('Runtime.enable');await send('Page.enable');
  const evaluate=async expression=>{
    const result=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
    if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);
    return result.result.value;
  };
  for(let i=0;i<150;i++){
    if(await evaluate(`document.readyState!=='loading'&&typeof window.toggleTheme==='function'`))break;
    if(i===149)throw new Error('LabLens did not finish loading within 15 seconds');
    await wait(100);
  }
  const checks=[];
  const check=async(name,expression)=>{const value=await evaluate(expression);const passed=value&&value.ok!==false;if(!passed)throw new Error(`UI check failed: ${name} (${JSON.stringify(value)})`);checks.push(name)};

  await check('first-run skip closes onboarding',`(()=>{document.querySelector('#firstRunModal .btn-secondary').click();return !document.getElementById('firstRunModal').classList.contains('active')})()`);
  await check('theme toggle changes theme',`(()=>{const before=document.documentElement.getAttribute('data-theme');const btn=document.getElementById('themeToggleBtn');btn.click();const after=document.documentElement.getAttribute('data-theme');return {ok:after!==before,before,after,disabled:btn.disabled,handler:typeof btn.onclick,global:typeof window.toggleTheme,ready:document.readyState}})()`);
  await check('add profile opens and cancel closes',`(()=>{document.querySelector('.add-user-btn').click();const opened=document.getElementById('addUserModal').classList.contains('active');document.querySelector('#addUserModal .btn-secondary').click();return opened&&!document.getElementById('addUserModal').classList.contains('active')})()`);
  await check('camera button targets camera input',`(()=>{window.__captureClicks=0;document.getElementById('captureInput').click=()=>window.__captureClicks++;document.getElementById('takePhotoBtn').click();return window.__captureClicks===1})()`);
  await check('browse button targets file input',`(()=>{window.__browseClicks=0;document.getElementById('fileInput').click=()=>window.__browseClicks++;document.getElementById('browseFilesBtn').click();return window.__browseClicks===1})()`);
  await check('multi-file grouping toggles',`(()=>{document.getElementById('gtCombine').click();const combined=document.getElementById('gtCombine').classList.contains('active');document.getElementById('gtSeparate').click();return combined&&document.getElementById('gtSeparate').classList.contains('active')})()`);
  await check('history empty state returns to upload',`(()=>{showHistory();const c=[...document.querySelectorAll('#historyList button')].find(b=>b.textContent.includes('Add your first'));if(!c)return false;c.click();return document.getElementById('uploadSection').style.display==='grid'})()`);
  await check('navigation exposes state and disables unavailable destinations',`(()=>{renderNav();const buttons=[...document.querySelectorAll('#headerNav .nav-btn')];return buttons.length===4&&buttons.find(b=>b.dataset.nav==='new').classList.contains('active')&&buttons.find(b=>b.dataset.nav==='current').disabled&&buttons.find(b=>b.dataset.nav==='trends').disabled})()`);
  await check('result tabs change panel and aria state',`(()=>{const buttons=[...document.querySelectorAll('#resultTabs .tab-btn')];for(const b of buttons){b.click();if(!b.classList.contains('active')||b.getAttribute('aria-selected')!=='true'||!document.getElementById('tab-'+b.dataset.tab).classList.contains('active'))return false}return true})()`);
  await check('save or print invokes browser print',`(()=>{window.__prints=0;window.print=()=>window.__prints++;document.querySelector('.download-btn').click();return window.__prints===1})()`);
  await check('feedback opens and cancel closes',`(()=>{document.querySelector('.feedback-fab').click();const opened=document.getElementById('feedbackModal').classList.contains('active');document.querySelector('#feedbackModal .btn-secondary').click();return opened&&!document.getElementById('feedbackModal').classList.contains('active')})()`);
  await check('saved report opens every populated result view',`(async()=>{
    const page='data:image/svg+xml;charset=utf-8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1180"><rect width="100%" height="100%" fill="white"/><text x="70" y="90" font-size="34" font-family="Arial" fill="#17212b">Sample Laboratory Report</text><text x="70" y="170" font-size="24" font-family="Arial" fill="#17212b">Hemoglobin 13.8 g/dL  12.0 - 16.0</text><text x="70" y="230" font-size="24" font-family="Arial" fill="#17212b">Glucose 106 mg/dL  70 - 99</text><text x="70" y="290" font-size="24" font-family="Arial" fill="#17212b">Vitamin D 24 ng/mL  30 - 100</text></svg>');
    const defs=[
      ['r1','2026-01-10',13.1,97,20],['r2','2026-03-10',13.5,102,22],['r3','2026-06-10',13.8,106,24]
    ];
    const reports=defs.map(([id,date,h,g,d],ri)=>{const metrics=[
      {key:'hemoglobin',name:'Hemoglobin',value:h,valueText:String(h),unit:'g/dL',status:'normal',min:12,max:16,normal_range:'12 - 16',srcLine:'Hemoglobin '+h+' g/dL',confidence:.99,bboxPage:0,bbox:{x0:.07,y0:.12,x1:.66,y1:.17}},
      {key:'glucose',name:'Glucose',value:g,valueText:String(g),unit:'mg/dL',status:g>99?'high':'normal',min:70,max:99,normal_range:'70 - 99',srcLine:'Glucose '+g+' mg/dL',confidence:.99,bboxPage:0,bbox:{x0:.07,y0:.18,x1:.58,y1:.23}},
      {key:'vitamin_d',name:'Vitamin D',value:d,valueText:String(d),unit:'ng/mL',status:d<30?'low':'normal',min:30,max:100,normal_range:'30 - 100',srcLine:'Vitamin D '+d+' ng/mL',confidence:.99,bboxPage:0,bbox:{x0:.07,y0:.24,x1:.6,y1:.29}}
    ];const high=metrics.filter(m=>m.status==='high').length,low=metrics.filter(m=>m.status==='low').length;return {id,date,analyzedAt:date,fileName:'Sample CBC '+(ri+1)+'.pdf',category:'lab',sourceMode:'digital',rawText:metrics.map(m=>m.srcLine+'  Ref '+m.normal_range).join('\\n'),docPages:[{image:page}],scanImages:[],metrics,totalMetrics:3,normalCount:3-high-low,highCount:high,lowCount:low,outOfRangeCount:high+low,safeCount:1,borderlineCount:0,concernCount:high+low,laymanSummary:'Three common markers were extracted. Verify flagged values against the original report.',recommendations:[{title:'Verify highlighted values',desc:'Compare glucose and vitamin D with the original report.'},{title:'Discuss changes in context',desc:'A clinician can interpret trends alongside symptoms, medicines, and history.'}],tags:[],note:'',audit:{uploadedCount:1,duplicateCount:0}}});
    localStorage.setItem('health_reports_guest',JSON.stringify(reports));showHistory();document.querySelector('.history-item').click();await new Promise(r=>setTimeout(r,120));
    return document.getElementById('resultsSection').classList.contains('active')&&document.querySelectorAll('#metricsList .metric-card').length===3&&document.querySelectorAll('#recommendationsList .rec-card').length===2;
  })()`);
  await check('summary and values controls open metric details',`(()=>{switchTab('detailed');const card=document.querySelector('#metricsList .metric-card');card.click();const opened=document.getElementById('metricSheetOverlay').classList.contains('active');closeMetricSheet();switchTab('summary');return opened&&!document.getElementById('metricSheetOverlay').classList.contains('active')})()`);
  await check('original report switches views and selection modes',`(async()=>{switchTab('document');const text=document.getElementById('originalTextBtn'),report=document.getElementById('originalVisualBtn');if(!text||!report)return false;text.click();const textOpen=!document.getElementById('originalTextPanel').hidden;Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async value=>{window.__copiedOriginal=value}}});document.getElementById('copyOriginalBtn').click();await new Promise(r=>setTimeout(r,20));report.click();document.getElementById('modeSelectBtn').click();const selectActive=document.getElementById('modeSelectBtn').getAttribute('aria-pressed')==='true';document.getElementById('modeBrowseBtn').click();return textOpen&&window.__copiedOriginal.includes('Hemoglobin')&&selectActive&&document.getElementById('modeBrowseBtn').getAttribute('aria-pressed')==='true'})()`);
  await check('trends selector, graph, and table controls agree',`(()=>{switchTab('comparison');const select=document.getElementById('trendMarkerSelect');if(!select||!document.querySelector('.trend-svg')||document.querySelectorAll('.trend-table tbody tr').length!==3)return false;select.value='glucose';select.dispatchEvent(new Event('change',{bubbles:true}));return document.querySelector('.trend-heading strong').textContent==='Glucose'&&document.querySelector('.trend-param-button[aria-current="true"]').textContent==='Glucose'})()`);
  await check('next steps renders actionable guidance',`(()=>{switchTab('recommendations');return document.querySelectorAll('#recommendationsList .rec-card').length===2&&document.getElementById('tab-recommendations').classList.contains('active')})()`);
  const inventory=await evaluate(`(()=>{const buttons=[...document.querySelectorAll('button')];return {buttons:buttons.length,disabled:buttons.filter(b=>b.disabled).length,unnamed:buttons.filter(b=>!(b.textContent||'').trim()&&!b.getAttribute('aria-label')).length}})()`);
  const screenshots=[];
  if(process.env.LABLENS_UI_SCREENSHOTS==='1'){
    for(const [name,width,height] of [['desktop',1440,1000],['mobile',390,844]]){
      await send('Emulation.setDeviceMetricsOverride',{width,height,screenWidth:width,screenHeight:height,deviceScaleFactor:1,mobile:name==='mobile'});
      await evaluate(`window.scrollTo(0,0);window.dispatchEvent(new Event('resize'));true`);
      await wait(150);
      for(const tab of ['summary','detailed','document','comparison','recommendations']){
        await evaluate(`switchTab('${tab}');window.scrollTo(0,document.getElementById('resultsSection').offsetTop);true`);await wait(120);
        if(name==='mobile'){
          const width=await evaluate(`({viewport:window.innerWidth,page:document.documentElement.scrollWidth})`);
          if(width.page>width.viewport+1)throw new Error(`Horizontal overflow in ${tab}: ${width.page}px page in ${width.viewport}px viewport`);
        }
        const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
        const file=path.join(os.tmpdir(),`lablens-ui-${name}-${tab}.png`);
        fs.writeFileSync(file,Buffer.from(shot.data,'base64'));
        screenshots.push(file);
      }
    }
  }
  process.stdout.write(JSON.stringify({checks:checks.length,passed:checks,inventory,screenshots},null,2)+'\n');
}finally{
  try{ws?.close()}catch{}
  browser.kill('SIGTERM');server.close();
  await wait(100);
  fs.rmSync(profile,{recursive:true,force:true});
}
