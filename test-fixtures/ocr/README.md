# OCR benchmark fixtures

Only synthetic or fully deidentified documents may be added here. Never commit
patient names, identifiers, dates of birth, addresses, accession numbers, QR
codes, barcodes, signatures, or report images containing protected information.

Each fixture has a human-verified canonical result in `expected/` and an engine
result in `actual/`. Run:

```sh
npm test
npm run benchmark:ocr
```

The benchmark treats a wrong high-confidence medical value as a separate release
failure. Ordinary character accuracy is not an adequate safety metric.
