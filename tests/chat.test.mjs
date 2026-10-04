import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

process.env.GEMINI_API_KEY='test-key';
const {default:chat}=await import('../netlify/functions/chat.mjs');
const {buildChatContext,MAX_QUESTIONS}=await import('../src/core/chat-context.mjs');
const {deidentify}=createRequire(import.meta.url)('../src/privacy/deidentify.js');

const CONTEXT='THIS REPORT (marker: value | reference range | status)\n- Hemoglobin: 11.2 g/dL | range: 12 - 15 g/dL | LOW';
const turn=(role,text)=>({role,text});
const post=(body,headers={'content-type':'application/json'})=>chat(new Request('http://localhost/api/chat',{method:'POST',headers,body:JSON.stringify(body)}));
const withUpstream=async(reply,run)=>{
  const realFetch=globalThis.fetch,calls=[];
  globalThis.fetch=async(url,init)=>{calls.push({url:String(url),body:JSON.parse(init.body)});return new Response(JSON.stringify({candidates:[{content:{parts:[{text:reply}]}}]}),{status:200})};
  try{return await run(calls)}finally{globalThis.fetch=realFetch}
};

test('a question is answered from the report summary only',async()=>{
  await withUpstream('Your hemoglobin is a little low.',async calls=>{
    const res=await post({context:CONTEXT,messages:[turn('user','Why is my hemoglobin low?')]});
    assert.equal(res.status,200);
    assert.equal((await res.json()).reply,'Your hemoglobin is a little low.');
    const sent=calls[0].body;
    assert.match(sent.systemInstruction.parts[0].text,/Never invent/);
    assert.equal(sent.contents.length,1);
    assert.match(sent.contents[0].parts[0].text,/Hemoglobin: 11\.2 g\/dL/);
    assert.match(sent.contents[0].parts[0].text,/QUESTION: Why is my hemoglobin low\?/);
  });
});

test('follow-up turns keep the conversation order',async()=>{
  await withUpstream('ok',async calls=>{
    const res=await post({context:CONTEXT,messages:[turn('user','one'),turn('model','answer'),turn('user','two')]});
    assert.equal(res.status,200);
    assert.deepEqual(calls[0].body.contents.map(c=>c.role),['user','model','user']);
    assert.ok(!calls[0].body.contents[2].parts[0].text.includes('REPORT DATA'),'the summary is sent once');
  });
});

test('the fourth question is refused before the provider is called',async()=>{
  assert.equal(MAX_QUESTIONS,3);
  const messages=[turn('user','1'),turn('model','a'),turn('user','2'),turn('model','b'),turn('user','3'),turn('model','c'),turn('user','4')];
  const res=await post({context:CONTEXT,messages});
  assert.equal(res.status,400);
  assert.equal((await res.json()).error,'bad_messages');
});

test('malformed conversations are refused',async()=>{
  for(const messages of [[],[turn('model','hi')],[turn('user','a'),turn('user','b')],[turn('user','a'),turn('model','b')],[turn('user','  ')],[turn('user','x'.repeat(1001))],'nope'])
    assert.equal((await post({context:CONTEXT,messages})).status,400,JSON.stringify(messages).slice(0,60));
});

test('text whose redaction differs from what was previewed is refused',async()=>{
  const identity=await post({context:'Patient Name: Jane Smith\n'+CONTEXT,messages:[turn('user','hi')]});
  assert.equal(identity.status,422);
  assert.equal((await identity.json()).error,'redaction_required');
  const question=await post({context:CONTEXT,messages:[turn('user','Email me at jane@example.com about this')]});
  assert.equal(question.status,422);
});

test('oversized, non-JSON and missing-context requests never reach the provider',async()=>{
  assert.equal((await post({context:'x'.repeat(12001),messages:[turn('user','hi')]})).status,413);
  assert.equal((await post({context:'x'.repeat(50000),messages:[turn('user','hi')]})).status,413);
  assert.equal((await post({context:CONTEXT,messages:[turn('user','hi')]},{'content-type':'text/plain'})).status,415);
  assert.equal((await post({messages:[turn('user','hi')]})).status,400);
});

test('preflight is allowed for the mobile WebView only',async()=>{
  const ok=await chat(new Request('https://example.com/api/chat',{method:'OPTIONS',headers:{origin:'capacitor://localhost'}}));
  assert.equal(ok.status,204);
  const denied=await chat(new Request('https://example.com/api/chat',{method:'OPTIONS',headers:{origin:'https://untrusted.example'}}));
  assert.equal(denied.status,403);
});

test('chat context carries values and relative history, never dates or identity',()=>{
  const m=(key,name,value,unit,range,status)=>({key,name,value,unit,normal_range:range,status});
  const out=buildChatContext({
    analysis:{id:3,date:'2026-08-26',fileName:'Jane Smith report.pdf',metrics:[
      m('hemoglobin','Hemoglobin',11.2,'g/dL','12 - 15 g/dL','low'),
      m('glucose','Glucose',90,'mg/dL','70 - 99','normal'),
      {...m('creatinine','Creatinine',0.9,'mg/dL','0.6 - 1.1','normal'),flaggedWrong:true},
      {key:'x',name:'Patient Name: Jane Smith',value:1,unit:'',normal_range:'',status:'normal'}]},
    history:[
      {id:1,date:'2026-03-01',metrics:[m('hemoglobin','Hemoglobin',12.1,'g/dL','12 - 15','normal')]},
      {id:2,date:'2026-06-20',metrics:[m('hemoglobin','Hemoglobin',11.8,'g/dL','12 - 15','low'),m('glucose','Glucose',4.9,'mmol/L','','normal')]},
      {id:3,date:'2026-08-26',metrics:[m('hemoglobin','Hemoglobin',11.2,'g/dL','','low')]},
      {id:4,date:'2027-01-01',metrics:[m('hemoglobin','Hemoglobin',9,'g/dL','','low')]}],
    deid:t=>deidentify(t).text});
  assert.match(out.text,/Hemoglobin: 11\.2 g\/dL \| range: 12 - 15 g\/dL \| LOW/);
  assert.match(out.text,/Hemoglobin: earlier 12\.1 \(about 6 months before\), 11\.8 \(about 2 months before\); this report 11\.2 g\/dL/);
  assert.ok(!/Creatinine/.test(out.text),'values marked as misread are excluded');
  assert.ok(!/Glucose: earlier/.test(out.text),'a different unit is not treated as the same trend');
  assert.ok(!/\b9\b/.test(out.text),'a later report is not "earlier"');
  assert.ok(!/Jane|Smith|2026|2027|\.pdf/.test(out.text),'no identity, file name or calendar date');
  assert.equal(out.dropped,1,'the identity-looking line was dropped');
  assert.equal(deidentify(out.text).text,out.text,'the preview equals what the server will accept');
  assert.equal(out.trendCount,1);
});
