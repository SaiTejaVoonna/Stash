# Stash roadmap

**Capture today. Find it tomorrow.** A private place for the things in your
life. You drop things in without thinking; Stash remembers, connects and finds;
any AI you choose can help, only with what you allow.

North star: from "where was that?" to having it in your hand in under 10
seconds, without filing anything by hand.

Principles:
- **Your device is the engine.** Storage, search, text reading and suggestions
  run on the phone or computer. No server of ours; running cost near zero.
- **You decide, the machine remembers.** People judge and name; Stash and AI
  recall, match and add up. Nothing moves without a tap; everything has Undo.
- **Open to any AI.** We build the best data and permissions; Claude, ChatGPT,
  Gemini or a local model connect through one open door (MCP). We don't build
  our own big AI.
- **Calm by default.** New people see only the Inbox; more appears when needed.

Rules for every phase: built on the working branch, tested (source and minified
build), shared as a test link. Nothing reaches `main` without the owner's "ok".
No real personal or medical data in code or tests. No keys or secrets in code.
No medical advice. Stash stores nothing on any server of ours. Personalisation
stays on the device, is visible, and can be wiped; nothing trains anyone's AI.

Technology: plain JavaScript, modernised in place (modules, type checking
through comments). Node.js only as a build and test tool. **Not** Next.js (it's
for server websites; Stash has no server on purpose) and no rewrite. Next:
SQLite on the device (WASM + OPFS), Web Workers, WebGPU for on-device models,
CRDTs for sync, Capacitor (phones), Tauri / Rust (computers), MCP (AI).

Visual preview of this plan: the "Stash Vision" page (shared separately).

---

## Done earlier: Features

### 1.1 Capture
- [x] Caption preview for everything: camera, Snap, gallery, files, paste, drag and drop, share. Snap still saves the instant it's taken; the caption is added after.
- [x] Albums: several photos sent together show as one grid. HD on/off.
- [x] Edit caption later.

### 1.2 Words and structure
- [x] Rename on screen: Me → **Inbox**, Spaces → **Collections**, Sub-chats → **Sections**, Pages → **Who / Where**, Forward → **Move to…** (data unchanged; "group" stays reserved).
- [x] Who / Where types: **Person · Place · Thing**, pre-picked from hint words ("Dr", "Hospital", "Cafe", "bike") and from the collection, corrected in one tap, learned from corrections.
- [x] Shared people, places and things across collections.
- [x] Doctors get a specialty; departments used as pages (e.g. "Dermatology", "ENT") are tidied into specialties once, with Undo.

### 1.3 Inbox
- [x] Filters: All · Unsorted · Photos · Files · Links · This week.
- [x] Select all · Move · Archive · Delete (Trash 30 days, Undo).
- [x] Clean up: blank messages, duplicates, old and untouched, biggest files. Optional auto-archive after 30 / 90 days.
- [x] Where it probably goes, on each message (one tap files it); the toast after moving says where. (A tag on moved messages isn't needed: they leave the Inbox.)
- [x] Swipe to file, search inside the Inbox. (Reply / quote left out: moved messages leave the Inbox.)

### 1.4 Notes essentials
- [x] Formatting: bold, italic, headings, bullet and numbered lists.
- [x] Note colours. Share a note as PDF or image.

### 1.5 Drawing
- [x] Pens: pen, pencil, marker, highlighter, calligraphy. Many colours plus custom; sizes.
- [x] Stylus pressure (Apple Pencil, S Pen); pen-only mode (palm doesn't draw).
- [x] Shapes that snap neat (line, arrow, circle, square); ruler.
- [x] Lasso select / move / resize; stroke eraser and normal eraser; text boxes.
- [x] Zoom and pan; paper styles (plain, lined, grid, dots). Save as image or PDF.

### 1.6 Files and media (add-ons)
- [x] Settings → Add-ons: switch features on or off; off ones aren't loaded.
- [x] Audio: add mp3 / m4a / wav; player with speed and skip; waveform.
- [x] Video: record or add; shrink big ones; player.
- [x] PDF viewer inside Stash; any other file stored and opened in the phone's app.
- [x] Bigger files (about 100 MB), storage used per collection, ask the browser to keep Stash's data.

### 1.7 Documents and scanner
- [x] **Documents** view: every PDF and scan from every collection in one list, with thumbnails, search and sort. Files still live in their collection.
- [x] Scanner v1: Take photo · From photos. Page edges found on the photo (live camera outline comes with v2), drag corners, straighten, filters (none, B&W, grey, colour boost), quality (small / medium / high), several pages → one PDF, reorder and delete pages, rename, share, print.
- [x] Signature: draw once, place on any PDF.
- [x] OCR on the device (Tesseract.js, downloaded on first use): text from photos and PDFs becomes searchable. Good on print, weak on handwriting.
- [ ] Scanner v2 (later): live camera outline, auto-capture, annotate, merge / split, compress.

### 1.8 Small extras (add-ons)
- [x] QR / barcode scanner. Contact cards (call / WhatsApp in one tap). Location pins (open in Maps). Add to calendar (.ics). Link cards. (Voice to text: use the keyboard's mic; the browser's own speech service sends audio to Google or Apple, so it's left out.)

### 1.9 The brain (understanding what you type)
- [x] `@` (where it goes) and `#` (what it's about) suggestions, shown only when typed; chips only when tapped. Pick between sections with the same name; more than one collection allowed.
- [x] Spot dates, money, km / litres, phone numbers as tap-to-use chips.
- [x] Read whole sentences using the person's own names and habits.
- [x] Sort / Sort all with a review list; setting: Suggest (default) or Auto when sure (with Undo).
- [x] Place memory: a snap near a saved place suggests that place.

### 1.10 Templates
- [x] Core 12 + Blank when creating; **Template store** for the rest: categories, search, featured, preview with example entries, Try for 7 days, share layouts by link (never entries).

### 1.11 Bring data in
- [x] Import from Google Keep (Takeout), Apple Notes (exported files), WhatsApp chat export (with media), a folder of photos or PDFs.

### 1.12 Ready to publish
- [x] Minify build for the published copy (`npm run build` → dist/; all tests pass on it too).
- [x] Help / FAQ page and privacy page.

---

## Done earlier: UI and UX

### 2.1 One way to do each thing
- [x] One picker everywhere (based on "Sort this snap"): search at the top, Collection → Section → Who / Where, **+ New** at the end of every row (collection, section, person, place, tag).
- [x] Calm composer: one thin line of chips instead of four rows; tags only from that collection.

### 2.2 Layout
- [x] Collapsible sidebar on computers: full, icons only, hidden; remembered. Collapsible groups inside it (Collections, Folders, Tags).
- [x] Resizable panes on computers (list / detail); keyboard shortcut to toggle the sidebar.
- [x] Tablets: sidebar slides over; two-pane in landscape.
- [x] Sticky date headers; sticky collection header while scrolling.

### 2.3 Feedback and help
- [x] Hover tooltips on every icon button (computers), long-press labels on phones.
- [x] Hover previews: a note or entry shows a small preview card on hover.
- [x] Empty states that say what to do next; first-run welcome (Inbox → Collections → Sync) with an example collection.
- [x] Sync dot in the header (green synced, orange waiting).
- [x] Undo for every destructive action; consistent toasts.

### 2.4 Comfort and access
- [x] App lock (PIN; Face ID / fingerprint where the browser allows).
- [x] Text size (small / normal / large). Reduced motion respected.
- [x] Screen-reader labels, bigger tap targets, contrast check in light and dark.
- [x] Speed with thousands of items (lists draw only what's on screen).
- [ ] App language: English first; Telugu and Hindi drafted (checked by a native speaker later). Not started: every on-screen word would first need moving into one word list, a large change across all files. Best done with a native speaker, once the words settle.

---

Earlier work (above) is done. From here, **four phases**.
**[you]** marks where the owner is needed; everything else needs no one.

## Phase 1: Calm, clear, smart [no one needed · ₹0]

What exists, made the best it can be: clean and consistent like Apple, Google
and Zerodha Kite; one obvious action like GPay; familiar like WhatsApp.

- [x] Suggestions say why in plain words ("Because it mentions Nimrah Cafe…"); **Not this** teaches Stash and is never suggested again for that message.
- [x] Your words: a personal dictionary (PUC = pollution certificate, Amma = Mother) used by search and suggestions.
- [x] What Stash has learned: visible, and forgettable with one tap (with Undo).
- [x] Find by memory: "hospital bill last week", "in March", "last 10 days"; When chips; why a result matched.
- [x] Calm first run: a short menu (empty views appear when used), a friendly empty Inbox with one action, phones start in the Inbox.
- [x] Copy for AI from notes, the Inbox and collections (never the Vault); the data format written down (`docs/DATA_FORMAT.md`).
- [x] Earlier in this phase: one picker, calm composer, sidebar states, hints, app lock, text size, accessibility, speed, security fixes.
- [ ] Split `index.html` into modules; type checking through JSDoc comments.
- [ ] Consistency pass, screen by screen: one button style, one spacing scale, the same words for the same things.
- [ ] Search by meaning on the device (a small model, about 25 MB): "doctor" finds "Dr Asha".

## Phase 2: Connected [you · about 30 minutes · free (domain optional)]

- [ ] **[you]** Pick hosting: Firebase (Google) or Cloudflare Pages, both free, each gives Stash its own safe address. Optional own domain (about ₹1,000 a year).
- [ ] **[you]** Create the Google client ID for Drive sync (guided).
- [ ] Hosting set up; the test link becomes "fake data only" history.
- [ ] Security headers (Content Security Policy, no framing, strict referrer), checked on real devices.
- [ ] Self-host the on-device libraries (photo guesser, text reader), so nothing runs from a CDN.
- [ ] Updates that always arrive ("New version, tap to update").
- [ ] Free code scanning (CodeQL, Dependabot).
- [ ] More sync choices: OneDrive, Dropbox, WebDAV (**[you]** register those apps when wanted).
- [ ] Sync that never loses an edit, even offline on two phones (CRDTs).

## Phase 3: Final build [you · $25 once + $99 a year]

- [ ] **[you]** Google Play account first; Apple Developer account when ready for iPhone.
- [ ] Android and iPhone apps (Capacitor): the phone's own scanner and text recognition, Face ID, share into Stash from any app, reliable reminders.
- [ ] Computer apps (Tauri): **clipboard history from any app and a global shortcut**.
- [ ] Open to any AI: an MCP connector on the device with per-collection permissions and a read log (tools listed in `docs/DATA_FORMAT.md`); autonomy levels the person picks (suggest → one tap → automatic with Undo → routines).
- [ ] Encrypt everything with a passphrase; optional encrypted sync; end-to-end encrypted family sharing.
- [ ] Reflections from your own data only ("fuel up 20% this month", "passport expires in 3 months"); never medical or financial advice.

## Phase 4: Testing and launch [you · about ₹0.5–3 lakh once]

- [ ] Real phones: iPhone and Android, camera, files, passkeys, offline, updates, storage limits.
- [ ] **[you]** Closed beta: 10–20 people, fake data first; watch 5 of them do set tasks (tasks and questions written for you). Measure task success, time to find, and the System Usability Scale.
- [ ] Free security checks (OWASP ZAP, Mozilla Observatory, securityheaders.com), then **[you]** an independent security test.
- [ ] **[you]** Name check and trademark, store listings, a simple website. Launch.
- [ ] Then monthly rounds of polish from real use.

## Research the plan stands on

Vannevar Bush, *As We May Think* (1945) · William Jones, *Keeping Found Things
Found* (2007) · Don Norman, *The Design of Everyday Things* · Steve Krug,
*Don't Make Me Think* · Daniel Kahneman, *Thinking, Fast and Slow* · B.J. Fogg,
*Tiny Habits* · Jef Raskin, *The Humane Interface* · Thaler and Sunstein,
*Nudge* · Barry Schwartz, *The Paradox of Choice* · Jon Yablonski, *Laws of UX*
· Ben Shneiderman, *Human-Centered AI* (2022) · Amershi et al., *Guidelines for
Human-AI Interaction* (CHI 2019) · Risko and Gilbert, *Cognitive offloading*
(2016) · Kleppmann et al., *Local-first software* (2019) · Tiago Forte,
*Building a Second Brain* · Sönke Ahrens, *How to Take Smart Notes*.

## What the outside assessments said, checked against the code

Useful, and now in the plan above:
- Clipboard history and a global shortcut need a real app → Phase 4 (computers).
- Built-in AI → Phase 5.
- Notes outside the Vault aren't encrypted on the device → Phase 6.
- Data can be lost if the browser clears it → already asks the browser to keep it (`navigator.storage.persist()`); on iPhone in a Safari tab that isn't enough, so Stash now reminds people to add it to the Home Screen (at most weekly), and the backup reminder stays.

Security review (ChatGPT, October 2026), checked and fixed:
- Imported tag emoji / colour could become HTML (stored XSS): fixed, tags are checked and escaped; regression test.
- HTML file import used innerHTML (an `<img onerror>` would run): fixed with DOMParser; regression test.
- Print view put image sources into HTML unchecked: fixed; regression test.
- CDN libraries had no integrity check: JSZip, jsQR, Tesseract and pdf.js now do (highlight.js already did). The on-device photo guesser (MediaPipe) loads as a module, which browsers can't integrity-check; self-hosting it is the fix, with hosting.
- Shared test-link address: correct and serious; Phase 3 item above.
- The failing phone test: a test that reloaded before a save finished; fixed. CI now also tests the minified build.

Not quite right:
- "App Lock is only a screen": true, and Stash says so in Settings. The Vault is the encrypted part.
- The dollar "valuation" and hour estimates are guesses, not something to plan by.
- "No persistent storage request": it was already there.
