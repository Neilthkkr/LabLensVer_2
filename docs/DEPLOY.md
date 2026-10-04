# Deploying LabLens

Netlify runs `npm run build:web` and publishes only `dist-web`. This keeps the
native projects, tests, local fixtures and server code out of static hosting.

```bash
netlify deploy --prod
```

## Optional AI checking

`netlify/functions/curate.mjs` serves `/api/curate` and `netlify/functions/chat.mjs` serves `/api/chat` (the in-app Ask AI chat; same `GEMINI_API_KEY`, max 3 questions per report, shared helpers in `netlify/lib/`). Without configuration the app works fully on the device and the
"Double-check with AI" option falls back to the on-device reader.

| Variable | Purpose |
| --- | --- |
| `GEMINI_API_KEY` | Key for the AI service. Use a paid tier so submitted text is not used for training. |
| `GEMINI_MODEL` | Optional, comma-separated model list tried in order (default: two lite models). |
| `GEMINI_PROVIDER` | Set to `vertex` only for a Google Cloud (Vertex AI) key. |

The browser shows the exact result text, age and sex for confirmation before each AI check. Automatic redaction is
best effort; users must inspect the preview. The function applies the same filter and rejects text that would change
server-side. It limits JSON bodies to 64 KB and allows 30 requests per client and 300 per function instance per hour.
Those counters reset with each serverless instance, so **set a provider-side spending quota before enabling the API
key**. Netlify's default function timeout is 10 seconds; long reports are sent in small chunks for that reason.

## Local development

```bash
GEMINI_API_KEY=... node scripts/dev-server.mjs     # static app + /api/curate + /api/chat on http://localhost:8765
node scripts/probe-curation.mjs report.pdf          # prints what would be sent and how AI rows compare
npm test                                            # unit tests
npm run test:ui                                     # browser smoke test (needs Chrome)
```

## Privacy notes

- Reports and profiles are stored in the browser's local storage. They are not encrypted.
- Info offers an unencrypted JSON backup of listed profiles, reports, medication records, and related selections; keep it somewhere private. Restore accepts current 1.1 and older 1.0 backups. A restore starts a separate `LabLens_PreRestore_…json` recovery download before replacing local records. Check that the file saved; a browser can block downloads. Older 1.0 backups lack medication records, so restoring one keeps any medication records already on this device.
- Feedback opens the user's email app with a draft; nothing is transmitted by LabLens.
- There is no telemetry.

## PWA install and updates

- iPhone/iPad: Safari, Share, Add to Home Screen. Android: Chrome menu, Install app.
- The service worker refreshes the app shell on load. If an old copy stays open, close the app fully and reopen it.
- Bump `CACHE_NAME` in `service-worker.js` when the list of precached assets changes.
