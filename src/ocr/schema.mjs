export const OCR_SCHEMA_VERSION = '1.0.0';

export const INPUT_KINDS = Object.freeze([
  'digital-pdf',
  'scanned-pdf',
  'mixed-pdf',
  'camera-image',
  'gallery-image'
]);

export const VERIFICATION_STATES = Object.freeze([
  'verified-source',
  'verified-consensus',
  'manually-confirmed',
  'needs-review',
  'excluded'
]);

const isFiniteNumber = value => typeof value === 'number' && Number.isFinite(value);

export function normalizePolygon(polygon) {
  if (!Array.isArray(polygon) || polygon.length < 4) return null;
  const normalized = polygon.map(point => {
    if (!Array.isArray(point) || point.length !== 2) return null;
    const [x, y] = point;
    return isFiniteNumber(x) && isFiniteNumber(y) ? [x, y] : null;
  });
  return normalized.every(Boolean) ? normalized : null;
}

export function createWord({ text, confidence = null, polygon = null, lineIndex = null } = {}) {
  return {
    text: String(text ?? ''),
    confidence: isFiniteNumber(confidence) ? Math.max(0, Math.min(1, confidence)) : null,
    polygon: normalizePolygon(polygon),
    lineIndex: Number.isInteger(lineIndex) ? lineIndex : null
  };
}

export function createPageResult({
  pageNumber,
  width,
  height,
  method,
  engine,
  text = '',
  words = [],
  confidence = null,
  durationMs = null,
  preprocessing = [],
  warnings = []
} = {}) {
  return {
    pageNumber,
    width,
    height,
    method,
    engine,
    text: String(text ?? ''),
    words: words.map(createWord),
    confidence: isFiniteNumber(confidence) ? Math.max(0, Math.min(1, confidence)) : null,
    durationMs: isFiniteNumber(durationMs) ? Math.max(0, durationMs) : null,
    preprocessing: preprocessing.map(String),
    warnings: warnings.map(String)
  };
}

export function createMetricCandidate({
  name,
  value,
  unit = '',
  referenceRange = '',
  pageNumber,
  polygon = null,
  confidence = null,
  verification = 'needs-review',
  sources = {},
  warnings = []
} = {}) {
  return {
    name: String(name ?? ''),
    value: String(value ?? ''),
    unit: String(unit ?? ''),
    referenceRange: String(referenceRange ?? ''),
    pageNumber,
    polygon: normalizePolygon(polygon),
    confidence: isFiniteNumber(confidence) ? Math.max(0, Math.min(1, confidence)) : null,
    verification,
    sources: Object.fromEntries(
      Object.entries(sources).map(([key, sourceValue]) => [String(key), String(sourceValue ?? '')])
    ),
    warnings: warnings.map(String)
  };
}

export function createDocumentResult({
  documentId,
  inputKind,
  pages = [],
  metrics = [],
  createdAt = new Date().toISOString(),
  deviceProfile = null,
  warnings = []
} = {}) {
  return {
    schemaVersion: OCR_SCHEMA_VERSION,
    documentId: String(documentId ?? ''),
    inputKind,
    createdAt,
    pages: pages.map(createPageResult),
    metrics: metrics.map(createMetricCandidate),
    deviceProfile,
    warnings: warnings.map(String)
  };
}

export function validateDocumentResult(document) {
  const errors = [];
  if (!document || typeof document !== 'object') return ['Document result must be an object.'];
  if (document.schemaVersion !== OCR_SCHEMA_VERSION) errors.push('Unsupported or missing schemaVersion.');
  if (!document.documentId) errors.push('documentId is required.');
  if (!INPUT_KINDS.includes(document.inputKind)) errors.push('inputKind is invalid.');
  if (!Array.isArray(document.pages) || document.pages.length === 0) errors.push('At least one page is required.');

  (document.pages || []).forEach((page, index) => {
    const label = `pages[${index}]`;
    if (!Number.isInteger(page.pageNumber) || page.pageNumber < 1) errors.push(`${label}.pageNumber is invalid.`);
    if (!isFiniteNumber(page.width) || page.width <= 0) errors.push(`${label}.width is invalid.`);
    if (!isFiniteNumber(page.height) || page.height <= 0) errors.push(`${label}.height is invalid.`);
    if (!page.method) errors.push(`${label}.method is required.`);
    if (!page.engine) errors.push(`${label}.engine is required.`);
  });

  (document.metrics || []).forEach((metric, index) => {
    const label = `metrics[${index}]`;
    if (!metric.name) errors.push(`${label}.name is required.`);
    if (!metric.value) errors.push(`${label}.value is required.`);
    if (!Number.isInteger(metric.pageNumber) || metric.pageNumber < 1) errors.push(`${label}.pageNumber is invalid.`);
    if (!VERIFICATION_STATES.includes(metric.verification)) errors.push(`${label}.verification is invalid.`);
    if (metric.verification !== 'excluded' && metric.confidence == null) errors.push(`${label}.confidence is required.`);
  });

  return errors;
}
