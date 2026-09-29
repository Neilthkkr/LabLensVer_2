# Deploying LabLens

The repository root is the deployable site (`publish = "."`). There is no build step.

```bash
netlify deploy --prod
```

## Optional AI checking

`netlify/functions/curate.mjs` serves `/api/curate`. Without configuration the app works fully on the device and the
"Double-check with AI" option falls back to the on-device reader.

| Variable | Purpose |
| --- | --- |
| `GEMINI_API_KEY` | Key for the AI service. Use a paid tier so submitted text is not used for training. |
| `GEMINI_MODEL` | Optional, comma-separated model list tried in order (default: two lite models). |
| `GEMINI_PROVIDER` | Set to `vertex` only for a Google Cloud (Vertex AI) key. |

Only de-identified result text plus age and sex is sent (see `src/privacy/deidentify.js`, applied in the browser and
again in the function). Netlify's default function timeout is 10 seconds; long reports are sent in small chunks for
that reason.

## Local development

```bash
GEMINI_API_KEY=... node scripts/dev-server.mjs     # static app + /api/curate on http://localhost:8765
node scripts/probe-curation.mjs report.pdf          # prints what would be sent and how AI rows compare
npm test                                            # unit tests
npm run test:ui                                     # browser smoke test (needs Chrome)
```

## Privacy notes

- Reports and profiles are stored in the browser's local storage. They are not encrypted.
- Feedback opens the user's email app with a draft; nothing is transmitted by LabLens.
- There is no telemetry.

## PWA install and updates

- iPhone/iPad: Safari, Share, Add to Home Screen. Android: Chrome menu, Install app.
- The service worker refreshes the app shell on load. If an old copy stays open, close the app fully and reopen it.
- Bump `CACHE_NAME` in `service-worker.js` when the list of precached assets changes.
