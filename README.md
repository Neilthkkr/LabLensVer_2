# LabLens Web

LabLens reads PDF and photo lab reports in the browser, shows extracted values
beside their reference ranges, and links results to the source text. Local PDF
and OCR processing works without an account. AI rechecking is optional: the
user reviews the exact outgoing text before a request reaches the Netlify
proxy. Reports and profiles are stored in browser local storage, which is **not
encrypted**.

This repository branch is the **web deployment**. It contains no iOS or Android
project files. The separate `mobile-development` branch preserves the native
app prototypes.

## Run and verify

```sh
npm test
npm run build:web
LABLENS_STATIC_ROOT=dist-web npm run test:ui
npm run benchmark:ocr:live
```

Netlify runs `npm run build:web` and publishes only `dist-web`; the function
under `netlify/functions/` holds the Gemini key on the server. See
[deployment instructions](docs/DEPLOY.md) for configuration and privacy notes.
The real-report accuracy corpus is not yet complete; see
[test-fixtures/ocr/README.md](test-fixtures/ocr/README.md).
