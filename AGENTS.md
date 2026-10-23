# Stash: notes for coding agents

Stash is a local-first notes, Inbox and collections app (vanilla JS PWA, no framework, no server). Live at https://stash.stvoonna.workers.dev (Cloudflare Workers serves `dist/`; it deploys by itself on every merge to `main`).

## Rules from the owner
- Nothing is stored by us: data stays on the person's device, optional sync to *their* Google Drive (`drive.file` only).
- Never put real personal or medical data in the repo. Fake names only (Dr Asha Verma, City Clinic, Corner Tea House, My scooter); never a real person, phone number or business on a fake bill.
- No secrets or AI keys in code. No medical advice. Don't claim "100% private".
- Work on the branch you're given; merge to `main` only when the owner says so.
- Plain, friendly words in the UI; spelling "colour" (Indian English).

## Layout
- `index.html`: the app shell and most UI. `groups.js`/`groups-core.js`: collections. `chat.js`: Inbox. `timeline.js`, `search-core.js`, `brain.js` (suggestions), `format.js` (Markdown ↔ rich editor), `sync.js` (Drive), `sw.js` (bump `CACHE` when files change), `demo.js` (demo data).
- Notes are stored as Markdown (`**bold**`, `++underline++`, `==highlight==`, `- [ ] task`).
- `README.md` (what Stash is, file map); `docs/README.md` (which doc is which); `docs/ROADMAP.md` (phases); `docs/DATA_FORMAT.md`.
- Naming: the app is Stash. Stored names (the `copypaster` database, `copypaster-*` saved keys, Vault encryption labels, `CP…` globals) keep the first-version spelling on purpose; renaming them would hide people's data.

## Test before every push
```bash
npx playwright test            # ~4 min, desktop + phone
npm run build && STASH_ROOT=dist npx playwright test   # the published copy
```
Tests run in plain-text editor mode by default (see `tests/fixtures.js`); `tests/rich.spec.js` covers the rich editor.

## Saving tokens
Read only the files you need (grep first). Keep replies short. One task per message.
