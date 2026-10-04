import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const source=html+'\n'+app;
const worker=fs.readFileSync(new URL('../service-worker.js',import.meta.url),'utf8');

test('on-device PDF assets resolve relative to the deployed app',()=>{
  assert.match(html,/<script src="\.\/vendor\/pdfjs\/pdf\.min\.js"><\/script>/);
  assert.match(source,/new URL\('\.\/vendor\/pdfjs\/pdf\.worker\.min\.js',document\.baseURI\)/);
  assert.match(source,/getDocument\(\{data:buf,isEvalSupported:false\}\)/);
  assert.doesNotMatch(html,/<script src="\/vendor\/pdfjs/);
});

test('a missing PDF engine is reported as a processing failure',()=>{
  assert.match(source,/code='PDF_ENGINE_UNAVAILABLE'/);
  assert.match(source,/kind:'processing'/);
  assert.match(source,/Couldn’t read this report/);
});

test('service worker refreshes the app shell before using its cache',()=>{
  assert.match(worker,/lablens-cache-v14/);
  assert.match(worker,/event\.request\.mode === 'navigate'/);
  assert.match(worker,/src\\\/core\\\/lab-parser/);
  const navigationBlock=worker.slice(worker.indexOf("event.request.mode === 'navigate'"));
  assert.ok(navigationBlock.indexOf('fetch(event.request)')<navigationBlock.indexOf('caches.match(event.request.mode'));
});

test('the single report picker accepts PDFs and images and does not force the camera',()=>{
  const filePicker=html.match(/<input(?=[^>]*id="fileInput")(?=[^>]*type="file")[^>]*>/)?.[0]||'';
  assert.match(filePicker,/accept="[^"]*application\/pdf/);
  assert.match(filePicker,/accept="[^"]*image\/jpeg/);
  assert.doesNotMatch(filePicker,/\bcapture=/);
  assert.match(source,/if\(blocked\.length\)return showToast/);
  const start=source.indexOf('function gradeImageQualityStats');
  const end=source.indexOf('\nasync function assessImageQuality',start);
  assert.ok(start>=0&&end>start,'image quality grader is discoverable');
  const context={};vm.createContext(context);
  vm.runInContext(`${source.slice(start,end)}\nthis.grade=gradeImageQualityStats`,context);
  assert.equal(context.grade({width:1800,height:2400,mean:180,contrast:52,sharpness:18}).level,'good');
  assert.equal(context.grade({width:500,height:700,mean:25,contrast:10,sharpness:3}).level,'poor');
  assert.equal(context.grade({width:1000,height:1600,mean:180,contrast:40,sharpness:5}).level,'warn');
});

test('add report opens the single file picker on every device',()=>{
  const events=[];
  const controls={addReportBtn:{},dropZone:{addEventListener(){}},fileInput:{click(){events.push('files')}}};
  const start=source.indexOf('function wireUpload(){');
  const end=source.indexOf('\nasync function fileToDataURL',start);
  assert.ok(start>=0&&end>start,'upload wiring is discoverable');
  const context={$:id=>controls[id]};
  vm.createContext(context);
  vm.runInContext(`${source.slice(start,end)}\nthis.wireUpload=wireUpload`,context);
  context.wireUpload();
  controls.addReportBtn.onclick();
  assert.deepEqual(events,['files']);
  assert.equal(typeof controls.fileInput.onchange,'function','selection is handled');
});

test('every button is wired and every inline handler resolves',()=>{
  const buttonTags=[...html.matchAll(/<button\b[^>]*>/gi)].map(match=>match[0]);
  const deliberatelyWired=new Set(['addReportBtn','confirmDialogCancel','confirmDialogOk','btnRejectionClose','btnRejectionRetry','btnSubmitFeedback']);
  const unwired=buttonTags.filter(tag=>{
    if(/\bonclick\s*=|\btype\s*=\s*["']submit["']/i.test(tag))return false;
    const id=tag.match(/\bid=["']([^"']+)["']/i)?.[1];
    return !deliberatelyWired.has(id);
  });
  assert.deepEqual(unwired,[],'buttons must submit a form, have an inline action, or be explicitly wired in JavaScript');

  const declared=new Set([
    ...[...source.matchAll(/\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g)].map(match=>match[1]),
    ...[...source.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/g)].map(match=>match[1])
  ]);
  const platformCalls=new Set(['catch','execCommand','function','getElementById','join','map','open','remove','select','setTimeout','stopPropagation','then','writeText']);
  const handlerCalls=new Set(
    [...html.matchAll(/onclick=(?:"([^"]*)"|'([^']*)')/g)]
      .flatMap(match=>[...(match[1]??match[2]).matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)].map(call=>call[1]))
      .filter(name=>!platformCalls.has(name))
  );
  assert.deepEqual([...handlerCalls].filter(name=>!declared.has(name)).sort(),[],'inline handler functions must exist');
});

test('result actions and tabs use one clear action with accessible state',()=>{
  assert.equal((html.match(/class="download-btn"/g)||[]).length,1,'avoid duplicate print and PDF actions');
  assert.match(html,/>Save or print report<\/button>/);
  const resultTabs=html.match(/<div aria-label="Report views"[\s\S]*?<\/div>/)?.[0]||'';
  assert.equal((resultTabs.match(/\brole="tab"/g)||[]).length,5);
  assert.equal((resultTabs.match(/\baria-selected="(?:true|false)"/g)||[]).length,5);
});

test('profiles can be edited from the home card and the Info tab, and deleted from the edit dialog',()=>{
  assert.match(html,/id="editProfileBtn"[^>]*onclick="editCurrentProfile\(\)"|onclick="editCurrentProfile\(\)"[^>]*id="editProfileBtn"/);
  assert.doesNotMatch(source,/__edit/,'the profile menu is for switching profiles, not editing');
  assert.match(html,/id="profileList"/);
  assert.match(html,/id="deleteUserBtn"/);
  // Escape / cancel dismissal picks the first .btn-secondary, so the delete control must not use that class.
  assert.doesNotMatch(html.match(/<button[^>]*id="deleteUserBtn"[^>]*>/)[0],/btn-secondary/);
});
