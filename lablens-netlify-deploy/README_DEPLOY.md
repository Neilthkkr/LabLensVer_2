# LabLens — Netlify Deploy Folder (Lab-only PWA)

This folder is a **clean, drag-and-drop Netlify deployable**. It contains only production files — no backups, no `uploads/`, no scratch files.

Created: 2026-09-17 (Asia/Dubai). Includes the **revised `scale_architecture.md`** ("LabLens: Modularization Options").

## Contents

| File | Purpose |
|---|---|
| `index.html` | Lab-only PWA (production app). Single-file, offline-first. |
| `service-worker.js` | PWA offline cache + auto-update (`lablens-cache-v2`, `skipWaiting`). |
| `manifest.webmanifest` | PWA install metadata (name, icons, theme). |
| `icon.svg` | PWA launcher icon. |
| `netlify.toml` | Netlify config: `publish = "."`, security headers/CSP, no-cache for SW + manifest. |
| `netlify/functions/stats.js` | Anonymous telemetry counters (Netlify Blobs). No medical data. |
| `netlify/functions/feedback.js` | Feedback forwarder → `lablens.support@gmail.com` via Resend. |
| `scale_architecture.md` | Reference doc: when/whether to modularize (not required at runtime). |

Deliberately **excluded**: `LabLens_multimodal.html` (backup), `uploads/`.

## Deploy Option A — Drag & Drop (simplest)

1. Zip this folder's **contents** (or drag the folder itself) into [Netlify Drop](https://app.netlify.com/drop).
2. Netlify assigns a URL like `https://<your-site>.netlifylify.app`.
3. Set the environment variable below, then **Redeploy** (variables only apply on a new deploy).

## Deploy Option B — Netlify CLI

```bash
cd lablens-netlify-deploy
netlify deploy --prod
```

## Required environment variable (feedback email)

Feedback posting fails gracefully to a `mailto:` fallback without this key — set it so the in-app form sends directly.

- Netlify Dashboard → your site → **Site configuration → Environment variables → Add a variable**
- **Key:** `RESEND_API_KEY`
- **Value:** your Resend API key (starts with `re_...`, from [resend.com/api-keys](https://resend.com/api-keys))
- Check **"Contains secret values"**
- **Scopes:** All scopes (Functions scope alone is sufficient, All is simplest)
- **Deploy contexts / Values:** same value for all contexts
- Click **Save**, then **Deploys → Trigger deploy → Deploy site** to apply.

Sender identity (already coded in `netlify/functions/feedback.js`):

- **From:** `LabLens Support <support@karuaerkak.resend.app>` (your Resend free-tier domain)
- **To (destination inbox):** `lablens.support@gmail.com`

## After deploy — verify

1. Open the Netlify URL on desktop + phone. Confirm tagline **"Your private lens on Labs"** and upload heading **"Click here to upload your file for analysis"**.
2. Upload a lab PDF / clear lab photo. A valid lab report must parse; non-lab files must show **"❌ Upload Rejected — Lab Reports Only"**.
3. PWA install: iOS Safari → Share → **Add to Home Screen**; Android Chrome → menu → **Install app / Add to Home screen**.
4. If an old version seems stuck (especially iOS PWA): close the app fully, reopen, and wait a few seconds — the service worker auto-updates (`skipWaiting` + `controllerchange` reload). As a **last resort for testing only**, append `?clear=1` to the URL — ⚠️ this wipes all local LabLens data (profiles/history) in that browser.

## Notes

- Publish directory is the folder root (`publish = "."` in `netlify.toml`). If you connect Git instead of drag-drop, point Netlify's publish directory at the folder containing `index.html`.
- No build step, no `npm install`. Single-file app + two serverless functions.
- Telemetry endpoint: `/.netlify/functions/stats` (events: `user_created`, `report_added`). Feedback endpoint: `/.netlify/functions/feedback`.
- Privacy: reports stay on-device (`localStorage`); only anonymous counters and user-initiated feedback leave the browser.
