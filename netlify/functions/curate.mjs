// Serverless proxy: receives de-identified lab text plus age and sex, asks Gemini
// for a curated parameter list, returns JSON. The API key stays in the Netlify
// environment and is never sent to the browser. Nothing is logged or stored.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { deidentify, demographics } = require('../../src/privacy/deidentify.js');
import { withinLimit, readBoundedJson, gate, callGemini } from '../lib/proxy-common.mjs';

const MAX_CHARS = 30000;
const MAX_BODY_BYTES = 64000;

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

export default async (req) => {
  const gated=gate(req);
  if(gated.response)return gated.response;
  const json=gated.json;
  const key = process.env.GEMINI_API_KEY;
  if (!key) return json(503, { error: 'not_configured' });
  if(!/^application\/json(?:;|$)/i.test(req.headers.get('content-type')||''))return json(415,{error:'json_required'});
  if(!withinLimit(req))return json(429,{error:'rate_limited'});

  const body=await readBoundedJson(req,MAX_BODY_BYTES);
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

  const res = await callGemini(payload, key);
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
