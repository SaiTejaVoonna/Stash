# Stash

**Capture today. Find it tomorrow.**

Stash is a local-first notes, Inbox and collections app. You drop things in
(text, photos, files, scans, drawings) without thinking about where they go.
Stash remembers them, suggests where they belong, and finds them again.

- Live: <https://stash.stvoonna.workers.dev> (works in any modern browser; add it to your Home Screen on a phone)
- Status: **a personal project in active development.** It is not a released product, and it has no users or clients.
- Plain JavaScript web app (PWA). No framework, no server of ours, no account.

## Privacy, in plain words

- Your notes, photos and files are kept **on your own device**, in the browser's storage. Stash has no server that stores them.
- Optional sync copies your data to a "Stash" folder in **your own Google Drive**. Stash can only see files it created there (`drive.file`).
- The **Vault** is the encrypted part: items you move into it are locked with a password only you know. The app lock (a PIN) only hides the screen.
- Suggestions, search and text reading run on the device. Nothing is sent to any AI unless you copy text out yourself ("Copy for AI").
- Browsers can clear site data. Export a backup now and then (Settings → Your data).

## What works today

**Four tabs and one +** (on phones)
- **Inbox**, **Library** (Collections, Notes and Documents, with "Sorted for you" counts), **Search** (the search field sits at the bottom, under your thumb), and **Me** (backup and App lock cards, then everything else). The **+** in the middle opens one sheet: note, photo, scan, drawing and more.
- Keys, passwords and card numbers you drop into the Inbox are spotted, and Stash offers to move them to the Vault. It only suggests.
- Commands, Passwords and 2FA, and the Template store are off for new people. They are one switch away in Me › Add-ons, and anyone who already uses them keeps them.

**Capture**
- Inbox: a chat with yourself. Text, photos, files, albums, Snap (camera first, caption after), drag and drop, paste.
- Filters, search, select, archive, Trash with Undo, and a clean-up tool for blanks, duplicates and old files.
- Import from Google Keep, Apple Notes exports, WhatsApp chat exports, and folders of photos or PDFs.

**Notes**
- A rich editor that saves plain Markdown (bold, headings, lists, tick boxes, highlight), as cards or a list, with colours.
- Share a note as PDF or image. Pin, folders, tags, Trash, reminders.
- Drawing pad: pens, highlighter, shapes that snap neat, lasso, text, stylus pressure, paper styles.

**Collections**
- A collection is a timeline for one topic (Health, Food, Bike, Trips), with sections, people, places and things shared across collections.
- Entries with amounts, dates and photos; views as Timeline, Photos or Table (totals, copy table).
- Templates: a core set plus a template store.

**Finding things**
- Smart search: `apollo #lab space:health date:2026-03 is:fav`, or plain memory like "hospital bill last week".
- Timeline: every note and entry by date, with filters.
- Your words: a personal dictionary (PUC = pollution certificate) used by search and suggestions.
- Suggestions that say why, and **Not this** teaches Stash. What it has learned is visible and forgettable.

**Documents and scanner**
- One Documents list for every PDF and scan, with an in-app PDF viewer.
- Scanner: photograph paper, straighten it, clean it up, save pages as one PDF; draw a signature once and place it on any PDF.
- Text reading (OCR) on the device makes scanned bills searchable.

**Safety and comfort**
- Vault, app lock, profiles (separate sets of data), backup and restore.
- Optional Google Drive sync, light and dark themes, true black and warm paper, text size, reduced motion, screen-reader labels, works offline.
- Add-ons you can switch off (audio, video, QR scanner, contacts, location pins, password builder, 2FA codes).

**Not done yet** (see the roadmap): the same one-look polish on every screen, merging Folders and Tags into Collections, search by meaning, more sync choices (OneDrive, Dropbox, WebDAV), conflict-free sync across devices, Android and iPhone apps, computer apps with clipboard history, an MCP connector for AI assistants, whole-app encryption, app languages, and live-camera scanning. Phase 1's "one look everywhere" pass is partly done (Settings and Inbox).

## Run it

```bash
npm ci
node tests/server.js          # serves the app at http://localhost:8790
```

The app itself needs no build. Service workers only run on `http://` or `https://`, so open it through the server above rather than as a file.

## Test and build

```bash
npx playwright test                                   # source copy, desktop and phone sizes (about 5 minutes)
npm run build && STASH_ROOT=dist npx playwright test  # the minified published copy
```

`npm run build` writes the minified copy into `dist/`. Cloudflare Workers serves `dist/` (see `wrangler.jsonc`) and the site updates by itself whenever `main` changes. GitHub Actions (`.github/workflows/tests.yml`) runs both test passes on every push.

## What each file does

The files sit side by side in the repo root because `index.html`, `sw.js` and the build load each other by path.

| File | What it does |
|---|---|
| `index.html` | The app shell and most of the screens: notes, editor, Vault, settings, sidebar, dock, profiles. |
| `sw.js` | Service worker: offline support. Bump `CACHE` whenever files change. |
| `manifest.webmanifest`, `icons/` | Install-to-Home-Screen details and icons. |
| `help.html`, `privacy.html` | The Help / FAQ page and the privacy page. |
| `groups-core.js`, `groups.js`, `groups.css` | Collections ("groups" in the code): data rules, screens, styles. |
| `entities-core.js` | People, places and things shared across collections. |
| `chat.js` | The Inbox. |
| `timeline.js`, `search-core.js` | Timeline and the smart search language. |
| `brain.js`, `words.js`, `see.js` | On-device suggestions, your personal dictionary, a rough guess at what a photo shows. |
| `format.js` | Markdown and the rich editor; sharing a note as image or PDF. |
| `sketch.js` | The drawing pad. |
| `snap.js`, `scanner.js`, `ocr.js`, `documents.js` | Camera capture, document scanner and signature, text reading, the Documents list and PDF viewer. |
| `sync-core.js`, `sync.js` | Google Drive sync: readable files, and the connection. |
| `applock.js`, `password-core.js`, `totp-core.js` | App lock, password builder, 2FA codes. |
| `icons.js`, `fonts/` | Every icon: one place that maps icon names to Material Symbols (outlined), and the icon font itself (Apache 2.0 licence, see `fonts/LICENSE-material-symbols.txt`). |
| `tools.js`, `tools.css` | Tool sheets (password builder, 2FA, recorder, sketch) and the Timeline and tool styles. |
| `extras.js`, `power.js`, `hints.js` | QR, contacts, location pins; "/" commands; tooltips and previews. |
| `importer.js`, `ai.js`, `demo.js` | Import from other apps; "Copy for AI"; made-up demo data. |
| `tests/` | About 200 Playwright tests (`*.phone.spec.js` run at phone size). |
| `scripts/build.js` | Builds the minified copy into `dist/`. |
| `docs/` | Design and data notes. Start at [`docs/README.md`](docs/README.md). |

## Naming note

The app was first called CopyPaster. The name you see is Stash everywhere. A few stored names (the browser database, saved settings, a few `CP…` script names) keep the old `copypaster` spelling on purpose: renaming a database or a saved key would hide existing data, and the Vault's encryption labels must not change.

## Rules this project follows

- Fake data only in the repo and tests (Dr Asha Verma, City Clinic, Corner Tea House, My scooter). No real person, number or business.
- No keys or secrets in code. No medical advice. No "100% private" claims.
- Plain, friendly words in the app; spelling "colour".

## Licence

All rights reserved. See [`LICENSE`](LICENSE).
