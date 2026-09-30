// Serverless proxy: receives de-identified lab text plus age and sex, asks Gemini
// for a curated parameter list, returns JSON. The API key stays in the Netlify
// environment and is never sent to the browser. Nothing is logged or stored.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { deidentify, demographics } = require('../../src/privacy/deidentify.js');

const MAX_CHARS = 30000;
const MAX_BODY_BYTES = 64000;
const WINDOW_MS = 60 * 60 * 1000;
const MAX_REQUESTS_PER_CLIENT = 30;
const MAX_REQUESTS_PER_INSTANCE = 300;
const usage = new Map();
function withinLimit(req) {
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
async function readBoundedJson(req){
  const reader=req.body?.getReader();
  if(!reader)return null;
  const decoder=new TextDecoder();let bytes=0,raw='';
  for(;;){
    const {done,value}=await reader.read();
    if(done)break;
    bytes+=value.byteLength;
    if(bytes>MAX_BODY_BYTES){await reader.cancel().catch(()=>{});return {tooLarge:true};}
    raw+=decoder.decode(value,{stream:true});
  }
  raw+=decoder.decode();
  try{return JSON.parse(raw)}catch{return null}
}
// Lite models are fast and rarely overloaded; larger ones returned 503 during testing.
// Override with GEMINI_MODEL (comma-separated, tried in order).
const MODELS = (process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite,gemini-3.5-flash-lite').split(',').map((m) => m.trim()).filter(Boolean);
// Keys created in Google AI Studio (including the newer "AQ." format) use the Gemini
// Developer API. Set GEMINI_PROVIDER=vertex only for a Google Cloud (Vertex AI) key.
const endpoint = (model) => process.env.GEMINI_PROVIDER === 'vertex'
  ? `https://aiplatform.googleapis.com/v1/publishers/google/models/${model}:generateContent`
  : `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

const ROW = {
  type: 'OBJECT',
  properties: {
    name: { type: 'STRING' },
    value: { type: 'NUMBER', nullable: true },
    valueText: { type: 'STRING', nullable: true },
    qualifier: { type: 'STRING', nullable: true },
    unit: { type: 'STRING', nullable: true },
    refLow: { type: 'NUMBER', nullable: true },
    refHigh: { type: 'NUMBER', nullable: true },
    refText: { type: 'STRING', nullable: true },
    flag: { type: 'STRING', nullable: true },
    sourceLine: { type: 'STRING' }
  },
  required: ['name', 'sourceLine']
};
const SCHEMA = {
  type: 'OBJECT',
  properties: { isLabReport: { type: 'BOOLEAN' }, parameters: { type: 'ARRAY', items: ROW } },
  required: ['isLabReport', 'parameters']
};

const PROMPT = `You extract laboratory test results from OCR/PDF text of a lab report.
Rules:
- Return one entry per measured parameter. Ignore headers, footers, method notes, comments and interpretation text.
- "value" is the numeric result exactly as printed. If it is not a single number (e.g. "Positive", "Trace"), set value null and put it in valueText.
- "qualifier" is "<" or ">" only when the report prints one before the value.
- "unit", "refLow", "refHigh" and "refText" are copied from the report only. Never supply a range the report does not print.
- "flag" is H, L or null, only if the report prints it.
- "sourceLine" is the exact line of input text the result came from, copied verbatim.
- Never invent, correct, convert or infer values. If unsure, omit the row.
- Placeholders like [DATE] or [NAME] are redactions; ignore them.
- Set isLabReport false if the text is not a laboratory result.`;

const jsonResponse = (status, body, origin) =>
  new Response(JSON.stringify(body), { status, headers: {
    'content-type': 'application/json', 'cache-control': 'no-store',
    ...(origin?{'access-control-allow-origin':origin,'vary':'Origin'}:{})
  } });

export default async (req) => {
  const origin=req.headers.get('origin');
  const allowedOrigin=!origin||origin===new URL(req.url).origin||['capacitor://localhost','http://localhost'].includes(origin)?origin:null;
  if(origin&&!allowedOrigin)return jsonResponse(403,{error:'origin_not_allowed'});
  const json=(status,body)=>jsonResponse(status,body,allowedOrigin);
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:{
    'access-control-allow-origin':allowedOrigin||'',
    'access-control-allow-methods':'POST, OPTIONS',
    'access-control-allow-headers':'content-type',
    'cache-control':'no-store','vary':'Origin'
  }});
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return json(503, { error: 'not_configured' });
  if(!/^application\/json(?:;|$)/i.test(req.headers.get('content-type')||''))return json(415,{error:'json_required'});
  if(!withinLimit(req))return json(429,{error:'rate_limited'});

  const body=await readBoundedJson(req);
  if(body?.tooLarge)return json(413,{error:'too_large'});
  if(!body||typeof body!=='object')return json(400,{error:'bad_json'});
  if (typeof body.text !== 'string' || !body.text.trim()) return json(400, { error: 'no_text' });
  if (body.text.length > MAX_CHARS) return json(413, { error: 'too_large' });

  // Second gate: scrub again server-side, and only accept age and sex as demographics.
  const demo = demographics(Number(body.age), body.sex);
  const clean = deidentify(body.text).text;
  // The browser preview must match what goes to the provider byte for byte.
  if(clean!==body.text)return json(422,{error:'redaction_required'});

  const payload = {
    contents: [{ role: 'user', parts: [{ text: `${PROMPT}\n\nPatient demographics: sex=${demo.sex || 'unknown'}, age=${demo.age ?? 'unknown'}\n\nREPORT TEXT:\n${clean}` }] }],
    generationConfig: { temperature: 0, responseMimeType: 'application/json', responseSchema: SCHEMA }
  };

  let res;
  const call = (model) => fetch(endpoint(model), {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(9000)
  });
  // Try each model in order; move on when one is overloaded (429/503), unavailable (404) or slow.
  for (const model of MODELS) {
    try {
      res = await call(model);
      if (res.ok || (res.status !== 429 && res.status !== 503 && res.status !== 404)) break;
    } catch { res = null; }
  }
  if (!res) return json(504, { error: 'upstream_timeout' });
  if (!res.ok) {
    // Upstream error text is only surfaced when debugging locally; it never contains report text.
    const detail = process.env.CURATE_DEBUG ? (await res.text().catch(() => '')).slice(0, 600) : undefined;
    return json(502, { error: 'upstream_error', status: res.status, detail });
  }

  try {
    const data = await res.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.parameters)) throw new Error('shape');
    return json(200, { isLabReport: !!parsed.isLabReport, parameters: parsed.parameters.slice(0, 300), sent: clean.length });
  } catch { return json(502, { error: 'bad_upstream_response' }); }
};

export const config = { path: '/api/curate' };
