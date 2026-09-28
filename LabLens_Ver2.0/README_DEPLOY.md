# LabLens Ver2.0 deployment

This is the ready-to-deploy LabLens Ver2.0 package. It contains the app, local OCR/PDF engines, PWA assets, and Netlify security headers. No build step or environment variables are required.

## Deploy

Upload this folder to Netlify Drop, or run:

```bash
cd LabLens_Ver2.0
netlify deploy --prod
```

The publish directory is the folder root (`publish = "."`). No `npm install` or environment variables are required.

## Feedback

The feedback form opens the user's email app with a draft addressed to `lablens.support@gmail.com`. The user reviews the draft and taps Send in that app. LabLens does not transmit the message or attach screenshots; users can add an attachment themselves.

## Data and privacy

- Reports and profiles are processed in the browser and stored in that browser's local storage. They are not encrypted, so anyone with access to the browser profile may be able to read them.
- The optional Google AI feature sends the selected lab values to Google only after the user confirms the disclosure.
- Feedback is shared only when the user chooses to send the draft from their email app.
- There is no telemetry collection.

## PWA install and updates

- iPhone/iPad: open the site in Safari, tap Share, then Add to Home Screen.
- Android: open the site in Chrome, open the menu, then Install app / Add to Home screen.
- The package includes PNG launcher icons for iOS and Android. If an existing home-screen icon remains blurry or stale after redeploy, remove the old shortcut and add it again.
- The service worker checks for updates. If an old copy remains open, close the app fully and reopen it.

## Before publishing

Open the deployed site on desktop and phone, check the security headers, and confirm that feedback opens an email draft without sending automatically. Upload a sample report and verify the extracted values against the original.
