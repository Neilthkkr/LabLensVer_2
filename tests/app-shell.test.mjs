import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const worker=fs.readFileSync(new URL('../service-worker.js',import.meta.url),'utf8');

test('on-device PDF assets resolve relative to the deployed app',()=>{
  assert.match(html,/<script src="\.\/vendor\/pdfjs\/pdf\.min\.js"><\/script>/);
  assert.match(html,/new URL\('\.\/vendor\/pdfjs\/pdf\.worker\.min\.js',document\.baseURI\)/);
  assert.match(html,/getDocument\(\{data:buf,isEvalSupported:false\}\)/);
  assert.doesNotMatch(html,/<script src="\/vendor\/pdfjs/);
});

test('a missing PDF engine is reported as a processing failure',()=>{
  assert.match(html,/code='PDF_ENGINE_UNAVAILABLE'/);
  assert.match(html,/kind:'processing'/);
  assert.match(html,/Couldn’t read this report/);
});

test('service worker refreshes the app shell before using its cache',()=>{
  assert.match(worker,/lablens-cache-v10/);
  assert.match(worker,/event\.request\.mode === 'navigate'/);
  const navigationBlock=worker.slice(worker.indexOf("event.request.mode === 'navigate'"));
  assert.ok(navigationBlock.indexOf('fetch(event.request)')<navigationBlock.indexOf("caches.match('./index.html')"));
});

test('report sources provide camera, photos, and PDF or image files',()=>{
  const filePicker=html.match(/<input(?=[^>]*id="fileInput")(?=[^>]*type="file")[^>]*>/)?.[0]||'';
  const photosPicker=html.match(/<input(?=[^>]*id="photosInput")(?=[^>]*type="file")[^>]*>/)?.[0]||'';
  const cameraPicker=html.match(/<input(?=[^>]*id="captureInput")(?=[^>]*type="file")[^>]*>/)?.[0]||'';
  assert.match(filePicker,/accept="[^"]*application\/pdf/);
  assert.match(filePicker,/accept="[^"]*image\/jpeg/);
  assert.match(photosPicker,/accept="[^"]*image\/jpeg/);
  assert.doesNotMatch(photosPicker,/\bcapture=/);
  assert.match(cameraPicker,/capture="environment"/);
  assert.match(html,/<dialog[^>]*id="reportSourceDialog"[^>]*>/);
  assert.match(html,/if\(blocked\.length\)return showToast/);
  const start=html.indexOf('function gradeImageQualityStats');
  const end=html.indexOf('\nasync function assessImageQuality',start);
  assert.ok(start>=0&&end>start,'image quality grader is discoverable');
  const context={};vm.createContext(context);
  vm.runInContext(`${html.slice(start,end)}\nthis.grade=gradeImageQualityStats`,context);
  assert.equal(context.grade({width:1800,height:2400,mean:180,contrast:52,sharpness:18}).level,'good');
  assert.equal(context.grade({width:500,height:700,mean:25,contrast:10,sharpness:3}).level,'poor');
  assert.equal(context.grade({width:1000,height:1600,mean:180,contrast:40,sharpness:5}).level,'warn');
});

test('add report opens source choices and each choice uses its own picker',()=>{
  const events=[];
  const controls=Object.fromEntries(['addReportBtn','reportSourceCancel','reportSourceCamera','reportSourcePhotos','reportSourceFiles','srcCameraInput','srcPhotosInput','srcFilesInput'].map(id=>[id,{}]));
  controls.dropZone={addEventListener(){}};
  controls.reportSourceDialog={showModal(){events.push('choices')},close(){events.push('close')}};
  for(const [id,source] of [['captureInput','camera'],['photosInput','photos'],['fileInput','files']]){
    controls[id]={click(){events.push(source)}};
  }
  const start=html.indexOf('function wireUpload(){');
  const end=html.indexOf('\nasync function fileToDataURL',start);
  assert.ok(start>=0&&end>start,'upload wiring is discoverable');
  let coarse=true;
  const context={$:id=>controls[id],matchMedia:()=>({matches:coarse})};
  vm.createContext(context);
  vm.runInContext(`${html.slice(start,end)}\nthis.wireUpload=wireUpload`,context);
  context.wireUpload();
  controls.addReportBtn.onclick();
  assert.deepEqual(events,['choices'],'touch devices get the source sheet');
  events.length=0;coarse=false;controls.addReportBtn.onclick();
  assert.deepEqual(events,['files'],'desktop opens the file browser directly');
  // The three phone source buttons are real file inputs laid over the tap target: no click proxy to break.
  for(const id of ['srcCameraInput','srcPhotosInput','srcFilesInput'])assert.equal(typeof controls[id].onchange,'function',id+' must handle its own selection');
  events.length=0;
  for(const [button,source] of [['reportSourceCamera','camera'],['reportSourcePhotos','photos'],['reportSourceFiles','files']]){
    events.length=0;
    controls[button].onclick();
    assert.deepEqual(events,['close',source]);
  }
});

test('every button is wired and every inline handler resolves',()=>{
  const buttonTags=[...html.matchAll(/<button\b[^>]*>/gi)].map(match=>match[0]);
  const deliberatelyWired=new Set(['addReportBtn','reportSourceCamera','reportSourcePhotos','reportSourceFiles','reportSourceCancel','confirmDialogCancel','confirmDialogOk','btnRejectionClose','btnRejectionRetry','btnSubmitFeedback']);
  const unwired=buttonTags.filter(tag=>{
    if(/\bonclick\s*=|\btype\s*=\s*["']submit["']/i.test(tag))return false;
    const id=tag.match(/\bid=["']([^"']+)["']/i)?.[1];
    return !deliberatelyWired.has(id);
  });
  assert.deepEqual(unwired,[],'buttons must submit a form, have an inline action, or be explicitly wired in JavaScript');

  const declared=new Set([
    ...[...html.matchAll(/\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g)].map(match=>match[1]),
    ...[...html.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/g)].map(match=>match[1])
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
