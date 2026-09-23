import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { scoreDocument } from '../src/ocr/benchmark.mjs';
import { validateDocumentResult } from '../src/ocr/schema.mjs';

const manifestPath = path.resolve(process.argv[2] || 'test-fixtures/ocr/manifest.json');
const root = path.dirname(manifestPath);
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const reports = [];

for (const fixture of manifest.fixtures || []) {
  if (fixture.containsPhi || fixture.deidentified !== true) {
    throw new Error(`Fixture ${fixture.id} is not explicitly marked deidentified.`);
  }
  const expected = JSON.parse(await readFile(path.resolve(root, fixture.expected), 'utf8'));
  const actual = JSON.parse(await readFile(path.resolve(root, fixture.actual), 'utf8'));
  const expectedErrors = validateDocumentResult(expected);
  const actualErrors = validateDocumentResult(actual);
  if (expectedErrors.length || actualErrors.length) {
    throw new Error(`${fixture.id} failed schema validation:\n${[...expectedErrors, ...actualErrors].join('\n')}`);
  }
  reports.push(scoreDocument(expected, actual));
}

const totals = reports.reduce((acc, report) => {
  acc.documents += 1;
  acc.numericExpected += report.numericTokens.expected;
  acc.numericTruePositive += report.numericTokens.truePositive;
  acc.numericFalsePositive += report.numericTokens.falsePositive;
  acc.numericFalseNegative += report.numericTokens.falseNegative;
  acc.metricsExpected += report.metrics.expected;
  acc.metricsMatched += report.metrics.matched;
  acc.exactValues += Math.round(report.metrics.exactValueRate * report.metrics.expected);
  acc.dangerousConfidentErrors += report.metrics.dangerousConfidentErrors;
  acc.totalDurationMs += report.performance.totalDurationMs;
  return acc;
}, {
  documents: 0,
  numericExpected: 0,
  numericTruePositive: 0,
  numericFalsePositive: 0,
  numericFalseNegative: 0,
  metricsExpected: 0,
  metricsMatched: 0,
  exactValues: 0,
  dangerousConfidentErrors: 0,
  totalDurationMs: 0
});

totals.numericRecall = totals.numericExpected ? totals.numericTruePositive / totals.numericExpected : 1;
totals.metricRecall = totals.metricsExpected ? totals.metricsMatched / totals.metricsExpected : 1;
totals.exactValueRate = totals.metricsExpected ? totals.exactValues / totals.metricsExpected : 1;

console.log(JSON.stringify({ manifest: manifestPath, totals, reports }, null, 2));

if (totals.dangerousConfidentErrors > 0) process.exitCode = 2;
