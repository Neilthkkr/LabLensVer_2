const NUMBER_TOKEN_RE = /[<>]=?\s*-?\d+(?:[.,]\d+)?|-?\d+(?:[.,]\d+)?/g;

export function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/[\u2012\u2013\u2014\u2212]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function numericTokens(value) {
  return (normalizeText(value).match(NUMBER_TOKEN_RE) || []).map(token => token.replace(/\s+/g, ''));
}

function multisetCounts(values) {
  const counts = new Map();
  values.forEach(value => counts.set(value, (counts.get(value) || 0) + 1));
  return counts;
}

export function scoreNumericTokens(expectedText, actualText) {
  const expected = numericTokens(expectedText);
  const actual = numericTokens(actualText);
  const remaining = multisetCounts(expected);
  let truePositive = 0;
  actual.forEach(token => {
    const count = remaining.get(token) || 0;
    if (count > 0) {
      truePositive += 1;
      remaining.set(token, count - 1);
    }
  });
  const falsePositive = actual.length - truePositive;
  const falseNegative = expected.length - truePositive;
  const precision = actual.length ? truePositive / actual.length : expected.length ? 0 : 1;
  const recall = expected.length ? truePositive / expected.length : actual.length ? 0 : 1;
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  return { expected: expected.length, actual: actual.length, truePositive, falsePositive, falseNegative, precision, recall, f1 };
}

function metricKey(metric) {
  return normalizeText(metric.name).replace(/[^a-z0-9]+/g, ' ').trim();
}

export function scoreMetrics(expectedMetrics = [], actualMetrics = [], highConfidenceThreshold = 0.95) {
  const actualByName = new Map(actualMetrics.map(metric => [metricKey(metric), metric]));
  let matched = 0;
  let exactValue = 0;
  let exactUnit = 0;
  let exactRange = 0;
  let dangerousConfidentErrors = 0;
  const errors = [];

  expectedMetrics.forEach(expected => {
    const actual = actualByName.get(metricKey(expected));
    if (!actual) {
      errors.push({ name: expected.name, type: 'missing-metric' });
      return;
    }
    matched += 1;
    const valueMatches = normalizeText(expected.value) === normalizeText(actual.value);
    const unitMatches = normalizeText(expected.unit) === normalizeText(actual.unit);
    const rangeMatches = normalizeText(expected.referenceRange) === normalizeText(actual.referenceRange);
    if (valueMatches) exactValue += 1;
    if (unitMatches) exactUnit += 1;
    if (rangeMatches) exactRange += 1;
    if (!valueMatches && Number(actual.confidence) >= highConfidenceThreshold) dangerousConfidentErrors += 1;
    if (!valueMatches || !unitMatches || !rangeMatches) {
      errors.push({
        name: expected.name,
        type: 'field-mismatch',
        expected: { value: expected.value, unit: expected.unit, referenceRange: expected.referenceRange },
        actual: { value: actual.value, unit: actual.unit, referenceRange: actual.referenceRange, confidence: actual.confidence }
      });
    }
  });

  const count = expectedMetrics.length;
  return {
    expected: count,
    predicted: actualMetrics.length,
    matched,
    metricRecall: count ? matched / count : 1,
    exactValueRate: count ? exactValue / count : 1,
    exactUnitRate: count ? exactUnit / count : 1,
    exactRangeRate: count ? exactRange / count : 1,
    dangerousConfidentErrors,
    errors
  };
}

export function scoreDocument(expected, actual) {
  const expectedText = (expected.pages || []).map(page => page.text || '').join('\n');
  const actualText = (actual.pages || []).map(page => page.text || '').join('\n');
  const durations = (actual.pages || []).map(page => page.durationMs).filter(Number.isFinite);
  return {
    documentId: expected.documentId,
    inputKind: expected.inputKind,
    numericTokens: scoreNumericTokens(expectedText, actualText),
    metrics: scoreMetrics(expected.metrics, actual.metrics),
    performance: {
      pages: (actual.pages || []).length,
      totalDurationMs: durations.reduce((sum, value) => sum + value, 0),
      meanPageDurationMs: durations.length ? durations.reduce((sum, value) => sum + value, 0) / durations.length : null
    }
  };
}
