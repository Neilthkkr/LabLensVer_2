import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const worker=fs.readFileSync(new URL('../service-worker.js',import.meta.url),'utf8');

test('on-device PDF assets resolve relative to the deployed app',()=>{
  assert.match(html,/<script src="\.\/vendor\/pdfjs\/pdf\.min\.js"><\/script>/);
  assert.match(html,/new URL\('\.\/vendor\/pdfjs\/pdf\.worker\.min\.js',document\.baseURI\)/);
  assert.doesNotMatch(html,/<script src="\/vendor\/pdfjs/);
});

test('a missing PDF engine is reported as a processing failure',()=>{
  assert.match(html,/code='PDF_ENGINE_UNAVAILABLE'/);
  assert.match(html,/kind:'processing'/);
  assert.match(html,/Couldn’t read this report/);
});

test('service worker refreshes the app shell before using its cache',()=>{
  assert.match(worker,/lablens-cache-v4/);
  assert.match(worker,/event\.request\.mode === 'navigate'/);
  const navigationBlock=worker.slice(worker.indexOf("event.request.mode === 'navigate'"));
  assert.ok(navigationBlock.indexOf('fetch(event.request)')<navigationBlock.indexOf("caches.match('./index.html')"));
});

test('mobile capture uses the rear camera and blocks clearly unusable photos',()=>{
  assert.match(html,/<input(?=[^>]*id="captureInput")(?=[^>]*capture="environment")[^>]*>/);
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
