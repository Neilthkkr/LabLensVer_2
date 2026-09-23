# OCR Phase 0: measurement foundation

Phase 0 changes no production OCR decision. Tesseract remains the active image
engine while alternatives are evaluated behind the same result contract.

## Contract

`src/ocr/schema.mjs` defines page-level extraction, word polygons, metric
candidates, confidence, provenance, verification state, warnings, performance,
and device profile data. Coordinates remain in source-page pixels so the UI can
always map a value back to its original evidence.

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
