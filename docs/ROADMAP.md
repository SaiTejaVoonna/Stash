# Stash roadmap

Four phases. Phase 1 and 2 need nothing from the owner: no accounts, no keys,
everything runs on the device. Phase 3 and 4 need the owner's accounts.

Rules for every phase: each part is built on the working branch, tested, and
shared as a test link. Nothing reaches `main` without the owner's "ok". No real
personal or medical data in code or tests. No keys or secrets in code. No
medical advice. Stash stores nothing on any server of ours.

Already done (on the branch): Google Drive sync (readable files per collection,
full backup) and two-way sync between devices, with Stash's own client ID ready
to be built in.

---

## Phase 1: Features (no support needed)

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

## Phase 2: UI and UX (no support needed)

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
- [ ] App lock (PIN; Face ID / fingerprint where the browser allows).
- [ ] Text size (small / normal / large). Reduced motion respected.
- [ ] Screen-reader labels, bigger tap targets, contrast check in light and dark.
- [ ] Speed with thousands of items (lists draw only what's on screen).
- [ ] App language: English first; Telugu and Hindi drafted (checked by a native speaker later).

---

## Phase 3: Cloud and hosting (needs the owner)

- [ ] Google: Stash's client ID built in; Google app published (Audience → Publish).
- [ ] Sync providers: Offline only (default) · Google Drive · Microsoft OneDrive · Dropbox · Nextcloud / WebDAV. One at a time; easy switching; optional weekly backup elsewhere; large files only on Wi-Fi. (Owner registers the Microsoft and Dropbox apps.)
- [ ] Hosting: Cloudflare Pages from the repo, owner's domain (or free `.pages.dev`), domains added to each provider's settings, test, then make the GitHub repo private.
- [ ] Trademark check for the name.
- [ ] Optional: AI with the person's own key (Analyse, Sort all with AI, ask across collections). Only selected items are sent; nothing moves without confirmation.
- [ ] Optional, much later and only if decided: Stash Cloud (end-to-end encrypted, paid).

## Phase 4: Apps (needs the owner)

- [ ] Wrap the web app with Capacitor: one codebase for web, Android and iPhone.
- [ ] Android first (Google Play, $25 once; builds without a Mac).
- [ ] iPhone: Apple Developer account ($99 / year), cloud Mac build (Codemagic or GitHub Actions), TestFlight.
- [ ] Native powers on phones: Apple's document scanner and text recognition, Face ID, safe file storage, share into Stash from any app, reliable reminder notifications; later iCloud sync and widgets.
