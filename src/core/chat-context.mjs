// What the in-app AI chat is allowed to see: marker names, values, units, reference
// ranges and statuses from the open report, plus earlier values of the SAME markers
// from this profile's other reports. Never the name, age, sex, date of birth, file
// name, report text or any calendar date: earlier results are described only as
// "about N months before". Every line is also passed through the de-identifier and
// dropped if it would change, so the text the person previews is the text that is sent.
export const MAX_QUESTIONS = 3;
const MONTH_MS = 30.44 * 24 * 60 * 60 * 1000;
const STATUS = { high: 'HIGH', low: 'LOW', normal: 'in range' };

const valueText = (m) => (m.valueText ? String(m.valueText) : `${m.qualifier || ''}${m.value ?? ''}`);
const usable = (m) => m && !m.flaggedWrong && m.name && (m.value != null && m.value !== '');
const unitKey = (u) => String(u || '').toLowerCase().replace(/\s+/g, '');
const monthsText = (n) => (n < 1 ? 'in the same month' : `about ${n} month${n === 1 ? '' : 's'} before`);

export function buildChatContext({ analysis, history = [], deid, maxMetrics = 60, maxTrends = 30 }) {
  const empty = { text: '', lines: [], metricCount: 0, trendCount: 0, dropped: 0 };
  if (!analysis || !Array.isArray(analysis.metrics)) return empty;
  const scrub = typeof deid === 'function' ? deid : (t) => t;
  const outOfRange = (m) => m.status === 'high' || m.status === 'low';
  const metrics = analysis.metrics.filter(usable)
    .sort((a, b) => Number(outOfRange(b)) - Number(outOfRange(a)))
    .slice(0, maxMetrics);

  const now = Date.parse(analysis.date);
  const priors = Number.isFinite(now)
    ? history.filter((h) => h && String(h.id) !== String(analysis.id) && Number.isFinite(Date.parse(h.date)) && Date.parse(h.date) <= now)
        .sort((a, b) => Date.parse(a.date) - Date.parse(b.date))
    : [];

  const resultLines = metrics.map((m) =>
    `- ${m.name}: ${valueText(m)}${m.unit ? ' ' + m.unit : ''} | range: ${m.normal_range || 'not stated'} | ${STATUS[m.status] || 'no verdict'}`);

  const trendLines = [];
  for (const m of metrics) {
    if (trendLines.length >= maxTrends || typeof m.value !== 'number' || !m.key) continue;
    const earlier = [];
    for (const h of priors) {
      const p = (h.metrics || []).find((x) => x && x.key === m.key && typeof x.value === 'number' && usable(x) &&
        (!x.unit || !m.unit || unitKey(x.unit) === unitKey(m.unit)));
      if (p) earlier.push(`${valueText(p)} (${monthsText(Math.round((now - Date.parse(h.date)) / MONTH_MS))})`);
    }
    if (earlier.length) trendLines.push(`- ${m.name}: earlier ${earlier.slice(-5).join(', ')}; this report ${valueText(m)}${m.unit ? ' ' + m.unit : ''}`);
  }

  let dropped = 0;
  const keep = (line) => { const ok = scrub(line) === line; if (!ok) dropped++; return ok; };
  const results = resultLines.filter(keep), trends = trendLines.filter(keep);
  const lines = ['THIS REPORT (marker: value | reference range | status)', ...results];
  if (trends.length) lines.push('EARLIER RESULTS OF THE SAME MARKERS (oldest first)', ...trends);
  return { text: lines.join('\n'), lines, metricCount: results.length, trendCount: trends.length, dropped };
}
