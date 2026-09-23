import test from 'node:test';
import assert from 'node:assert/strict';
import { createDocumentResult, createMetricCandidate, createPageResult, validateDocumentResult } from '../src/ocr/schema.mjs';

test('canonical OCR result validates', () => {
  const document = createDocumentResult({
    documentId: 'synthetic-cbc',
    inputKind: 'digital-pdf',
    pages: [createPageResult({ pageNumber: 1, width: 1200, height: 1600, method: 'pdf-text', engine: 'pdfjs', text: 'Haemoglobin 12.2 g/dL' })],
    metrics: [createMetricCandidate({ name: 'Haemoglobin', value: '12.2', unit: 'g/dL', referenceRange: '12.0-15.0', pageNumber: 1, confidence: 1, verification: 'verified-source' })]
  });
  assert.deepEqual(validateDocumentResult(document), []);
});

test('unverified metric requires confidence', () => {
  const document = createDocumentResult({
    documentId: 'invalid',
    inputKind: 'camera-image',
    pages: [createPageResult({ pageNumber: 1, width: 1, height: 1, method: 'ocr', engine: 'test' })],
    metrics: [createMetricCandidate({ name: 'Glucose', value: '92', pageNumber: 1 })]
  });
  assert.match(validateDocumentResult(document).join('\n'), /confidence is required/);
});
