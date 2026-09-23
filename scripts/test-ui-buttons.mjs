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
  const inventory=await evaluate(`(()=>{const buttons=[...document.querySelectorAll('button')];return {buttons:buttons.length,disabled:buttons.filter(b=>b.disabled).length,unnamed:buttons.filter(b=>!(b.textContent||'').trim()&&!b.getAttribute('aria-label')).length}})()`);
  const screenshots=[];
  if(process.env.LABLENS_UI_SCREENSHOTS==='1'){
    for(const [name,width,height] of [['desktop',1440,1000],['mobile',390,844]]){
      await send('Emulation.setDeviceMetricsOverride',{width,height,screenWidth:width,screenHeight:height,deviceScaleFactor:1,mobile:name==='mobile'});
      await evaluate(`window.scrollTo(0,0);window.dispatchEvent(new Event('resize'));true`);
      await wait(150);
      const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
      const file=path.join(os.tmpdir(),`lablens-ui-${name}.png`);
      fs.writeFileSync(file,Buffer.from(shot.data,'base64'));
      screenshots.push(file);
    }
  }
  process.stdout.write(JSON.stringify({checks:checks.length,passed:checks,inventory,screenshots},null,2)+'\n');
}finally{
  try{ws?.close()}catch{}
  browser.kill('SIGTERM');server.close();
  await wait(100);
  fs.rmSync(profile,{recursive:true,force:true});
}
