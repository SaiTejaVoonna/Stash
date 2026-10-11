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
- [ ] Caption preview for everything: camera, Snap, gallery, files, paste, drag and drop, share. Snap still saves the instant it's taken; the caption is added after.
- [ ] Albums: several photos sent together show as one grid. HD on/off.
- [ ] Edit caption later.

### 1.2 Words and structure
- [ ] Rename on screen: Me → **Inbox**, Spaces → **Collections**, Sub-chats → **Sections**, Pages → **Who / Where**, Forward → **Move to…** (data unchanged; "group" stays reserved).
- [ ] Who / Where types: **Person · Place · Thing**, pre-picked from hint words ("Dr", "Hospital", "Cafe", "bike") and from the collection, corrected in one tap, learned from corrections.
- [ ] Shared people, places and things across collections.
- [ ] Doctors get a specialty; departments used as pages (e.g. "Dermatology", "ENT") are tidied into specialties once, with Undo.

### 1.3 Inbox
- [ ] Filters: All · Unsorted · Photos · Files · Links · This week.
- [ ] Select all · Move · Archive · Delete (Trash 30 days, Undo).
- [ ] Clean up: blank messages, duplicates, old and untouched, biggest files. Optional auto-archive after 30 / 90 days.
- [ ] "→ Collection › Section" tag on moved messages; tap to jump there.
- [ ] Reply / quote, swipe to file, search inside the Inbox.

### 1.4 Notes essentials
- [ ] Formatting: bold, italic, headings, bullet and numbered lists.
- [ ] Note colours. Share a note as PDF or image.

### 1.5 Drawing
- [ ] Pens: pen, pencil, marker, highlighter, calligraphy. Many colours plus custom; sizes.
- [ ] Stylus pressure (Apple Pencil, S Pen); pen-only mode (palm doesn't draw).
- [ ] Shapes that snap neat (line, arrow, circle, square); ruler.
- [ ] Lasso select / move / resize; stroke eraser and normal eraser; text boxes.
- [ ] Zoom and pan; paper styles (plain, lined, grid, dots). Save as image or PDF.

### 1.6 Files and media (add-ons)
- [ ] Settings → Add-ons: switch features on or off; off ones aren't loaded.
- [ ] Audio: add mp3 / m4a / wav; player with speed and skip; waveform.
- [ ] Video: record or add; shrink big ones; player.
- [ ] PDF viewer inside Stash; any other file stored and opened in the phone's app.
- [ ] Bigger files (about 100 MB), storage used per collection, ask the browser to keep Stash's data.

### 1.7 Documents and scanner
- [ ] **Documents** view: every PDF and scan from every collection in one list, with thumbnails, search and sort. Files still live in their collection.
- [ ] Scanner v1: Camera roll · Take photo · Scan document. Live camera with page edges, drag corners, straighten, filters (none, B&W, grey, colour boost), quality (small / medium / high), several pages → one PDF, reorder and delete pages, rename, share, print.
- [ ] Signature: draw once, place on any PDF.
- [ ] OCR on the device (Tesseract.js, downloaded on first use): text from photos and PDFs becomes searchable. Good on print, weak on handwriting.
- [ ] Scanner v2 (later): auto-capture, annotate, merge / split, compress.

### 1.8 Small extras (add-ons)
- [ ] QR / barcode scanner. Contact cards (call / WhatsApp in one tap). Location pins (open in Maps). Add to calendar (.ics). Link cards. Voice to text where the phone supports it.

### 1.9 The brain (understanding what you type)
- [ ] `@` (where it goes) and `#` (what it's about) suggestions, shown only when typed; chips only when tapped. Pick between sections with the same name; more than one collection allowed.
- [ ] Spot dates, money, km / litres, phone numbers as tap-to-use chips.
- [ ] Read whole sentences using the person's own names and habits.
- [ ] Sort / Sort all with a review list; setting: Suggest (default) or Auto when sure (with Undo).
- [ ] Place memory: a snap near a saved place suggests that place.

### 1.10 Templates
- [ ] Core 12 + Blank when creating; **Template store** for the rest: categories, search, featured, preview with example entries, Try for 7 days, share layouts by link (never entries).

### 1.11 Bring data in
- [ ] Import from Google Keep (Takeout), Apple Notes (exported files), WhatsApp chat export (with media), a folder of photos or PDFs.

### 1.12 Ready to publish
- [ ] Minify build for the published copy (readable source stays in the repo).
- [ ] Help / FAQ page and privacy page.

---

## Phase 2: UI and UX (no support needed)

### 2.1 One way to do each thing
- [ ] One picker everywhere (based on "Sort this snap"): search at the top, Collection → Section → Who / Where, **+ New** at the end of every row (collection, section, person, place, tag).
- [ ] Calm composer: one thin line of chips instead of four rows; tags only from that collection.

### 2.2 Layout
- [ ] Collapsible sidebar on computers: full, icons only, hidden; remembered. Collapsible groups inside it (Collections, Folders, Tags).
- [ ] Resizable panes on computers (list / detail); keyboard shortcut to toggle the sidebar.
- [ ] Tablets: sidebar slides over; two-pane in landscape.
- [ ] Sticky date headers; sticky collection header while scrolling.

### 2.3 Feedback and help
- [ ] Hover tooltips on every icon button (computers), long-press labels on phones.
- [ ] Hover previews: a note or entry shows a small preview card on hover.
- [ ] Empty states that say what to do next; first-run welcome (Inbox → Collections → Sync) with an example collection.
- [ ] Sync dot in the header (green synced, orange waiting).
- [ ] Undo for every destructive action; consistent toasts.

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
