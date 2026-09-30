# LabLens: Modularization Options

> Historical design note. `app.js` has now been extracted from `index.html`.

This document evaluates whether to split `index.html` into a Vite-built, multi-file
project. It is not a recommendation to do this now — it's a reference for when the
tradeoff is actually worth making, and what it costs.

## Why this isn't a default "should do"

The current single-file architecture isn't an accident of prototyping — it's load-bearing
for two things already in production:

- The service worker (`service-worker.js`) treats the HTML document as network-first
  specifically so a fix to a wrong lab reading ships on the next load, not the load after
  next. A build step doesn't break this by itself, but every additional layer between
  "I changed the code" and "it's live" is a place that guarantee can quietly regress —
  a stale `dist/` on Netlify, a cache-busting filename that didn't update, a Capacitor
  shell that bundles an old asset. That risk has to be actively managed, not assumed away.
- Zero build tooling means zero supply-chain surface — no `npm install`, no transitive
  dependencies, nothing to audit. For a tool that parses medical data entirely
  client-side, that's a real property, not incidental simplicity.

So the question isn't "is modularization good practice" (generically, yes) — it's
whether a specific reason applies to this app right now.

## Reasons that would justify it

- **Native app store distribution.** Capacitor or Tauri is the actual argument for a
  build pipeline. If you want iOS/Android/desktop packages, you need a compiled asset
  pipeline regardless of file layout, and modular source is easier to work with inside it
  than a 5,000-line HTML file.
- **Multiple people editing the codebase concurrently.** One engineer touching
  `parseReportText` while another touches CSS in the same file is a real merge-conflict
  cost. If LabLens stays a solo project, this doesn't apply.
- **Automated regression tests for the parser.** This is the strongest reason and doesn't
  actually require the full pipeline below — Vitest can run against extracted modules
  without Capacitor/Tauri or even Netlify changes. If parser correctness testing is the
  goal, that's a much smaller project than what follows.

## Reasons that don't hold up

The original framing of this as protection against "stray syntax errors" reaching
production overstates what a bundler does. Vite's dev/build pipeline (via esbuild) will
fail the build on a JS parse error — a real unclosed brace or invalid syntax won't
silently ship. It will **not** catch:

- Logic errors (wrong condition, wrong variable, off-by-one)
- Type errors — there's no TypeScript in this proposal, so nothing checks that a value
  you're calling `.toFixed()` on is actually a number
- Most of the bug classes that would actually matter in a lab-value parser (e.g. the
  `metricSignature` crash you already hit on string values — that was a runtime type
  issue, not a syntax one, and a bundler would not have caught it)

If parser reliability is the goal, the actual fix is unit tests against known-good report
text (see "Reasons that would justify it" above), not a build step. Don't adopt the
pipeline for a benefit it doesn't provide.

## What's actually in `index.html` today

For reference, if a decomposition is done, these are the concrete pieces confirmed in
the current file (not assumed):

| Symbol | Current location | Target module |
|---|---|---|
| `STANDARD_RANGES` (clinical reference library) | line ~716 | `src/parsers/labParser.js` |
| `parseReportText` | line ~1607 | `src/parsers/labParser.js` |
| `LS` (localStorage wrapper) | line ~2132 | `src/db/storage.js` |
| `CATS` (report category dictionary) | line ~2149 | `src/config/categories.js` |
| `metricSignature` / `reportSignature` | line ~3120 | `src/parsers/labParser.js` |
| `displayResults`, `showRejectionModal`, `renderTrendGraph` | lines ~3682–4384 | `src/ui/results.js`, `src/ui/modals.js` |
| `GOOGLE_AI_URL_SAFE_LEN` + AI Mode handoff logic | line ~4698 | `src/ui/ai-handoff.js` |

Line numbers are approximate and will drift as the file changes — confirm against
current source before extracting, don't work from this table blind.

## If you do proceed: sequence and what it costs

1. **Set up Vite alongside the current file, not instead of it.** Keep `index.html`
   deployable as-is until the modular build is verified to produce equivalent output
   (same DOM, same behavior, same service-worker caching semantics). Don't cut over in
   one step on a medical tool.
2. **Extract CSS first.** Lowest risk — pure presentation, easy to diff visually.
3. **Extract `STANDARD_RANGES` and `parseReportText` together**, since the parser and
   its reference data are tightly coupled. Write the Vitest cases for known report text
   *before* extracting, so you have a regression baseline, not after.
4. **Extract `LS` and `CATS`.**
5. **Extract the UI renderers last** — they're the most tangled (DOM references, event
   handlers wired via inline `onclick`, cross-references to `currentAnalysis` global
   state). This is also where "modular" and "actually decoupled" diverge — moving
   functions into separate files doesn't remove the shared mutable state between them;
   it just relocates it. Don't treat the file split as having solved that on its own.
6. **Update the service worker and `netlify.toml`** for the new `dist/` output path and
   confirm the network-first-for-documents behavior still holds against the built output,
   not just the dev server.
7. **Only then** add Capacitor/Tauri targets, if native distribution is the actual goal.

Costs to weigh against this: a Node toolchain and `npm install` surface that doesn't
exist today, a build step between edit and deploy, and — for a while — two versions of
the app to keep in sync if you don't cut over cleanly. None of that is a good trade
for "cleaner file structure" alone; it's only worth it against one of the three reasons
above.
