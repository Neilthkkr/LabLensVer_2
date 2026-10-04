// Plumbing shared by the Gemini proxies (/api/curate, /api/chat): origin check,
// per-client rate limit, bounded body read, and the model-fallback upstream call.
// The API key stays in the Netlify environment; nothing here logs or stores request text.
const WINDOW_MS = 60 * 60 * 1000;
const MAX_REQUESTS_PER_CLIENT = 30;
const MAX_REQUESTS_PER_INSTANCE = 300;
const usage = new Map();
export function withinLimit(req) {
  const now=Date.now();
  for(const [id,bucket] of usage)if(bucket.until<=now)usage.delete(id);
  const client=req.headers.get('x-nf-client-connection-ip')||'unknown';
  for(const [id,limit] of [['all',MAX_REQUESTS_PER_INSTANCE],[`client:${client}`,MAX_REQUESTS_PER_CLIENT]]){
    const bucket=usage.get(id)||{count:0,until:now+WINDOW_MS};
    if(bucket.count>=limit)return false;
  }
  for(const id of ['all',`client:${client}`]){
    const bucket=usage.get(id)||{count:0,until:now+WINDOW_MS};
    bucket.count++;usage.set(id,bucket);
  }
  return true;
}
export async function readBoundedJson(req,maxBytes) {
  const reader=req.body?.getReader();
  if(!reader)return null;
  const decoder=new TextDecoder();let bytes=0,raw='';
  for(;;){
    const {done,value}=await reader.read();
    if(done)break;
    bytes+=value.byteLength;
    if(bytes>maxBytes){await reader.cancel().catch(()=>{});return {tooLarge:true};}
    raw+=decoder.decode(value,{stream:true});
  }
  raw+=decoder.decode();
  try{return JSON.parse(raw)}catch{return null}
}
export const jsonResponse = (status, body, origin) =>
  new Response(JSON.stringify(body), { status, headers: {
    'content-type': 'application/json', 'cache-control': 'no-store',
    ...(origin?{'access-control-allow-origin':origin,'vary':'Origin'}:{})
  } });
// Same-origin web, or the Capacitor WebView. Returns {json} for normal replies, or
// {response} when the request is already answered (forbidden origin, preflight, wrong verb).
export function gate(req) {
  const origin=req.headers.get('origin');
  const allowedOrigin=!origin||origin===new URL(req.url).origin||['capacitor://localhost','http://localhost'].includes(origin)?origin:null;
  if(origin&&!allowedOrigin)return {response:jsonResponse(403,{error:'origin_not_allowed'})};
  const json=(status,body)=>jsonResponse(status,body,allowedOrigin);
  if(req.method==='OPTIONS')return {response:new Response(null,{status:204,headers:{
    'access-control-allow-origin':allowedOrigin||'',
    'access-control-allow-methods':'POST, OPTIONS',
    'access-control-allow-headers':'content-type',
    'cache-control':'no-store','vary':'Origin'
  }})};
  if (req.method !== 'POST') return {response:json(405, { error: 'method_not_allowed' })};
  return {json};
}
// Lite models are fast and rarely overloaded; larger ones returned 503 during testing.
// Override with GEMINI_MODEL (comma-separated, tried in order).
const MODELS = (process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite,gemini-3.5-flash-lite').split(',').map((m) => m.trim()).filter(Boolean);
// Keys created in Google AI Studio (including the newer "AQ." format) use the Gemini
// Developer API. Set GEMINI_PROVIDER=vertex only for a Google Cloud (Vertex AI) key.
const endpoint = (model) => process.env.GEMINI_PROVIDER === 'vertex'
  ? `https://aiplatform.googleapis.com/v1/publishers/google/models/${model}:generateContent`
  : `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
// Try each model in order; move on when one is overloaded (429/503), unavailable (404) or slow.
export async function callGemini(payload,key,timeoutMs=9000) {
  let res=null;
  for (const model of MODELS) {
    try {
      res = await fetch(endpoint(model), {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(timeoutMs)
      });
      if (res.ok || (res.status !== 429 && res.status !== 503 && res.status !== 404)) break;
    } catch { res = null; }
  }
  return res;
}
