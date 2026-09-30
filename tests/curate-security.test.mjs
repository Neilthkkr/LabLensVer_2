import test from 'node:test';
import assert from 'node:assert/strict';

process.env.GEMINI_API_KEY='test-key';
const {default:curate}=await import('../netlify/functions/curate.mjs');
const request=(text,headers={'content-type':'application/json'})=>new Request('http://localhost/api/curate',{
  method:'POST',headers,body:JSON.stringify({text,age:35,sex:'female'})
});

test('proxy rejects text whose redaction differs from the approved preview',async()=>{
  const res=await curate(request('Patient Name: Jane Smith 13.2 g/dL\nGlucose 101 mg/dL 70 - 99'));
  assert.equal(res.status,422);
  assert.equal((await res.json()).error,'redaction_required');
});

test('proxy rejects oversized and non-JSON requests before the upstream call',async()=>{
  const big=await curate(request('x'.repeat(65000)));
  assert.equal(big.status,413);
  const wrongType=await curate(request('Glucose 101 mg/dL',{'content-type':'text/plain'}));
  assert.equal(wrongType.status,415);
});

test('mobile WebView preflight is allowed without calling Gemini',async()=>{
  const res=await curate(new Request('https://example.com/api/curate',{method:'OPTIONS',headers:{origin:'capacitor://localhost','access-control-request-method':'POST','access-control-request-headers':'content-type'}}));
  assert.equal(res.status,204);
  assert.equal(res.headers.get('access-control-allow-origin'),'capacitor://localhost');
  const denied=await curate(new Request('https://example.com/api/curate',{method:'OPTIONS',headers:{origin:'https://untrusted.example'}}));
  assert.equal(denied.status,403);
});
