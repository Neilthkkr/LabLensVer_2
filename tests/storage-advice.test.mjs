import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const block=(start,end)=>{
  const a=source.indexOf(start),b=source.indexOf(end,a+start.length);
  assert.ok(a>=0&&b>a,`${start} block exists`);
  return source.slice(a,b);
};

test('saved lab reports replace old condition-specific advice on load',()=>{
  const context={};vm.createContext(context);
  vm.runInContext(block('const SAFE_METRIC_STATUSES=', '\nconst LS=')+'\n'+block('function recommendations(high,low){','\nfunction layman(')+'\nthis.normalize=normalizeAnalysisRecord',context);
  const saved={category:'lab',metrics:[{key:'glucose',name:'Glucose',status:'high',value:101,unit:'mg/dL'}],recommendations:[{title:'Manage blood sugar',desc:'Change your diet.'}]};
  const loaded=context.normalize(saved);
  assert.equal(loaded.recommendations[0].title,'Verify the flagged values');
  assert.ok(!loaded.recommendations.some(r=>r.title==='Manage blood sugar'));
});

test('a failed browser write cannot be reported as a saved analysis',async()=>{
  const data=new Map();let fail=false;
  const context={
    localStorage:{getItem:k=>data.get(k)??null,setItem(k,v){if(fail)throw new Error('quota');data.set(k,v)},removeItem:k=>data.delete(k)},
    currentUser:null,currentAnalysis:null,showToast(){},updateUserInfoDisplay(){},confirmDialog:async()=>false,
    normalizeAnalysisRecord:r=>r
  };
  vm.createContext(context);
  vm.runInContext(block('const LS=', '\nlet toastTimer=')+'\n'+block('const historyKey=', '\nfunction renderUserSelect')+'\n'+block('function metricSignature(', '\n/* ============== IDENTITY DISCREPANCY CHECK')+'\nthis.save=saveAnalysis',context);
  const report={id:1,date:'2026-09-01',category:'lab',metrics:[],scanImages:[],docPages:[]};
  fail=true;
  await assert.rejects(context.save(report),/not saved/);
  assert.equal(context.currentAnalysis,null);
  assert.equal(data.size,0);
});

test('dismissing a later AI preview cannot reuse a prior Send choice',async()=>{
  const listeners=[];
  const dialog={returnValue:'',addEventListener(_name,handler){listeners.push(handler)},showModal(){},close(value){if(value!==undefined)this.returnValue=value;listeners.shift()()}};
  const nodes={curationConsent:dialog,curationConsentMeta:{textContent:''},curationConsentText:{textContent:''}};
  const context={$:id=>nodes[id]};vm.createContext(context);
  vm.runInContext(block('function confirmCurationPayload(body){','\nasync function fetchCuratedRows')+'\nthis.confirm=confirmCurationPayload',context);
  const body={text:'Glucose 101 mg/dL',age:null,sex:null};
  const first=context.confirm(body);dialog.close('send');assert.equal(await first,true);
  const second=context.confirm(body);dialog.close();assert.equal(await second,false);
});

test('failed profile migration never deletes the original records',()=>{
  const data=new Map([['health_reports_guest',JSON.stringify([{id:1}])]]);
  const context={localStorage:{getItem:k=>data.get(k)??null,setItem(){throw new Error('quota')},removeItem:k=>data.delete(k)}};
  vm.createContext(context);
  vm.runInContext(block('const LS=', '\nlet toastTimer=')+'\n'+block('function migrateGuestDataTo(username){','\nasync function addUser(e){')+'\nthis.migrate=migrateGuestDataTo',context);
  assert.throws(()=>context.migrate('Alex'),/storage is full/);
  assert.ok(data.has('health_reports_guest'));
  assert.equal(data.has('health_reports_Alex'),false);
});

test('a failed profile-list write rolls a rename back without orphaning reports',async()=>{
  const data=new Map([
    ['health_reports_Alex',JSON.stringify([{id:1}])],
    ['healthUsers',JSON.stringify([{username:'Alex',nickname:'Alex',sex:'female',dob:'1990-01-01'}])]
  ]);
  const fields={newUserName:{value:'Alicia'},newUserNickname:{value:'Ali'},newUserSex:{value:'female'},newUserDob:{value:'1990-01-01'}};
  const context={
    localStorage:{getItem:k=>data.get(k)??null,setItem(k,v){if(k==='healthUsers')throw new Error('quota');data.set(k,v)},removeItem:k=>data.delete(k)},
    USER_KEY_PREFIXES:['health_reports_'],editingUser:'Alex',currentUser:'Alex',users:[{username:'Alex',nickname:'Alex',sex:'female',dob:'1990-01-01'}],
    $:id=>fields[id],showToast:message=>message
  };
  vm.createContext(context);
  vm.runInContext(block('const LS=', '\nlet toastTimer=')+'\n'+block('function moveUserData(from,to){','\nasync function deleteProfile(){')+'\n'+block('async function addUser(e){','\n// The active profile drives')+'\nthis.addUser=addUser',context);
  const message=await context.addUser({preventDefault(){}});
  assert.match(message,/not updated/);
  assert.ok(data.has('health_reports_Alex'));
  assert.equal(data.has('health_reports_Alicia'),false);
  assert.equal(context.users[0].username,'Alex');
});

function backupHarness(initial,failWrite=()=>false){
  const data=new Map(Object.entries(initial).map(([key,value])=>[key,JSON.stringify(value)]));
  const downloads=[],toasts=[];
  const storage={get length(){return data.size},key:i=>[...data.keys()][i]??null,
    getItem:key=>data.get(key)??null,
    setItem(key,value){if(failWrite(key,value))throw new Error('quota');data.set(key,value)},
    removeItem:key=>data.delete(key)};
  const context={
    localStorage:storage,showToast:message=>toasts.push(message),confirmDialog:async()=>true,
    safeText:(value,max)=>String(value??'').slice(0,max),normalizeAnalysisRecord:record=>record,
    SAFE_METRIC_KEY:/^[a-z0-9_-]+$/i,setTimeout:()=>0,
    USER_KEY_PREFIXES:['health_reports_','health_meds_','health_medlog_','uploadCategory_','defaultTrendKey_','currentAnalysisId_'],
    FileReader:class{readAsText(file){this.onload({target:{result:JSON.stringify(file.backup)}})}},
    console:{error(){}}
  };
  vm.createContext(context);
  vm.runInContext(block('const LS=', '\nlet toastTimer=')+'\n'+block('function buildBackupData(){','\nfunction populateCategoryUI(){')+'\nthis.build=buildBackupData;this.importBackup=importBackup',context);
  context.downloadBackupData=(value,name)=>downloads.push({value,name});
  return {data,downloads,toasts,context};
}

test('backup includes medication records and restores them with reports',async()=>{
  const h=backupHarness({
    healthUsers:[{username:'Alex'}],currentUser:'Alex',health_reports_Alex:[{id:1}],
    health_meds_Alex:[{name:'Medicine A'}],health_medlog_Alex:[{taken:true}],
    'lablens_gemini_curation':true
  });
  const backup=JSON.parse(JSON.stringify(h.context.build()));
  assert.equal(backup.version,'1.1.0');
  assert.equal(backup.medications.Alex[0].name,'Medicine A');
  assert.equal(backup.medicationLogs.Alex[0].taken,true);
  h.data.set('health_meds_Alex',JSON.stringify([{name:'Medicine B'}]));
  h.context.importBackup({size:100,backup});
  await new Promise(setImmediate);
  assert.equal(JSON.parse(h.data.get('health_meds_Alex'))[0].name,'Medicine A');
  assert.equal(JSON.parse(h.data.get('health_reports_Alex'))[0].id,1);
  assert.equal(h.data.get('lablens_gemini_curation'),'true');
  assert.match(h.downloads[0].name,/PreRestore/);
  assert.equal(h.downloads[0].value.medications.Alex[0].name,'Medicine B');
});

test('legacy restore preserves medication records absent from old backups',async()=>{
  const h=backupHarness({healthUsers:[{username:'Alex'}],health_reports_Alex:[{id:1}],health_meds_Alex:[{name:'Medicine A'}]});
  h.context.importBackup({size:100,backup:{version:'1.0.0',users:[{username:'Alex'}],reports:{Alex:[{id:2}]}}});
  await new Promise(setImmediate);
  assert.equal(JSON.parse(h.data.get('health_reports_Alex'))[0].id,2);
  assert.equal(JSON.parse(h.data.get('health_meds_Alex'))[0].name,'Medicine A');
});

test('failed restore puts prior records back and leaves a recovery download',async()=>{
  const h=backupHarness({healthUsers:[{username:'Alex'}],health_reports_Alex:[{id:1}]},
    (key,value)=>key==='health_reports_Alex'&&value.includes('"id":2'));
  h.context.importBackup({size:100,backup:{version:'1.1.0',users:[{username:'Alex'}],reports:{Alex:[{id:2}]},medications:{guest:[],Alex:[]},medicationLogs:{guest:[],Alex:[]}}});
  await new Promise(setImmediate);
  assert.equal(JSON.parse(h.data.get('health_reports_Alex'))[0].id,1);
  assert.match(h.toasts.at(-1),/previous records were put back/);
  assert.match(h.downloads[0].name,/PreRestore/);
});

test('trends exclude misreads and values in different units',()=>{
  const reports=[
    {id:1,date:'2026-01-01',metrics:[{key:'glucose',value:5.6,unit:'mmol/L'}]},
    {id:2,date:'2026-02-01',metrics:[{key:'glucose',value:101,unit:'mg/dL',flaggedWrong:true}]},
    {id:3,date:'2026-03-01',metrics:[{key:'glucose',value:105,unit:'mg/dL'}]}
  ];
  const context={getHistory:()=>reports,metricValueText:m=>String(m.value),normalizedUnit:u=>String(u).toLowerCase()};
  vm.createContext(context);
  vm.runInContext(block('function trendSeriesFor(key){','\n// The range filter')+'\nthis.series=trendSeriesFor',context);
  const series=context.series('glucose');
  assert.equal(series.length,1);assert.equal(series[0].value,105);
  assert.equal(series.excludedUnits,1);
});
