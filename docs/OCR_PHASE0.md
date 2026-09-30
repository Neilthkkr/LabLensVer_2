# OCR Phase 0: measurement foundation

The web app uses local Tesseract. This phase establishes the benchmark and
review rules before any replacement OCR engine is considered for deployment.

## Contract

`src/ocr/schema.mjs` defines page-level extraction, word polygons, metric
candidates, confidence, provenance, verification state, warnings, performance,
and device profile data. The current `app.js` evidence overlay uses top-left normalized fractions.
The canonical schema still needs an explicit coordinate-space and orientation
field, followed by tests that map each extracted value back to its source page.

## Release metrics

The benchmark reports:

- exact numeric-token precision and recall;
- metric detection recall;
- exact value, unit, and reference-range rates;
- high-confidence wrong values;
- total and mean page duration.

No candidate engine may ship with a high-confidence wrong value in the approved
release corpus. Low-confidence extraction must enter review rather than receive a
normal/high/low classification.

## Fixture matrix to build

- digital PDF with clean text layer;
- digital PDF with scrambled extraction order;
- scanned PDF at 150, 200, and 300 DPI;
- camera photo with skew, shadow, glare, blur, and page curvature;
- screenshots and messaging-app recompression;
- multi-page and mixed text/scan PDFs;
- CBC, metabolic, lipid, thyroid, urine, qualitative, and inequality ranges;
- decimal comma, superscripts, uncommon units, and handwritten annotations.

All fixtures must be synthetic or irreversibly deidentified.

The current corpus contains one replayed synthetic PDF result and five live
synthetic image cases. It contains **zero independently reviewed real reports**.
`node scripts/run-ocr-benchmark.mjs test-fixtures/ocr/manifest.json --min-reviewed-real=1`
fails until a reviewed real fixture is added. A recorded `actual/` result is
useful for regression scoring, but release accuracy must be measured by running
the current web engine on the source documents before any release claim.
