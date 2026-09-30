# OCR benchmark fixtures

Only synthetic or fully deidentified documents may be added here. Never commit
patient names, identifiers, dates of birth, addresses, accession numbers, QR
codes, barcodes, signatures, or report images containing protected information.

The saved fixture has a canonical result in `expected/` and a recorded engine
result in `actual/`. Run:

```sh
npm test
npm run benchmark:ocr
npm run benchmark:ocr:live
```

`benchmark:ocr` replays one synthetic digital PDF result. It does not rerun PDF
extraction or OCR, so its score is a scorer check, not an accuracy estimate.
`benchmark:ocr:live` renders five synthetic images in temporary Chrome and
sends each through the app's upload, local Tesseract OCR, parser, review, and
save path. It checks ten exact values, units, ranges, statuses, and saved OCR
confidence. Cases cover decimal commas, units, previous-result columns,
comparison symbols, and mild shadow/skew. This is an end-to-end smoke test,
not a representative clinical benchmark. It requires Chrome and a loopback
server.

For release decisions, add deidentified examples of scanned PDF, real phone
photos, multi-column results, and qualitative findings. Record source-specific exact value,
unit, reference, recall, and high-confidence wrong-value rates. A wrong
high-confidence medical value is a separate release failure.

For a reviewed real fixture, add `source: "real"`, `reviewedByHuman: true`,
`reviewedAt: "YYYY-MM-DD"`, `deidentified: true`, and `containsPhi: false` to
its manifest entry. The expected JSON must be transcribed and checked against
the original by a person independently of parser output. Run
`node scripts/run-ocr-benchmark.mjs <manifest> --min-reviewed-real=N` to fail
when the requested corpus size is missing. Keep unredacted local originals in
the ignored `test-fixtures/ocr/private/` folder; never commit them.
