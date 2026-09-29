# LabLens

Private, on-device lab report reader. Add a PDF or photo, and every value is shown beside its reference range and
linked back to the line it was read from. Reports never leave the device unless the user turns on AI checking.

- `index.html` – the whole app (UI, parser, storage). Zero build tooling by design.
- `service-worker.js`, `manifest.webmanifest` – PWA shell.
- `src/privacy/deidentify.js` – scrubs text before anything is sent for AI checking (also used server-side).
- `netlify/functions/curate.mjs` – `/api/curate` proxy that keeps the AI key off the client.
- `vendor/` – PDF.js, Tesseract, fonts (self-hosted).
- `tests/`, `scripts/` – unit tests, browser smoke test, parser and OCR probes.
- `docs/` – deployment notes, architecture options, OCR notes.

See [docs/DEPLOY.md](docs/DEPLOY.md) to deploy and configure.
