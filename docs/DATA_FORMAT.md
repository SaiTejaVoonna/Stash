# Stash data format

Stash keeps everything on the person's device. This page describes the three
ways that data leaves the app, so any tool (or any AI connector) can read it
without Stash, and nobody is locked in, Stash included.

## 1. Backup file (`.cps`, JSON)

Settings → Your data → Export. Everything, in one file.

```json
{
  "cpsVersion": 2,
  "exportedAt": "2026-10-12T10:30:00.000Z",
  "items":   [ /* notes, Inbox messages (chat: true), passwords */ ],
  "tags":    [ { "id": "…", "name": "Trip", "color": "#4c8dff", "emoji": "" } ],
  "folders": [ { "id": "…", "name": "Work", "parentId": null } ],
  "groups":  [ /* collections: name, icon, colour, sections (subs), people/places (mainTags), fields */ ],
  "entries": [ /* collection entries: title, note, amount (paise), happenedOn, refs: [{ g, s, tag }], tags */ ],
  "entities": [ /* people, places and things shared across collections */ ],
  "entityTypes": { "extra": [], "custom": [] },
  "vault": { /* only when a Vault exists: its password-locked key */ }
}
```

- `cpsVersion: 1` files (no collections) still import.
- Amounts are whole numbers in the smallest unit (₹750 is `75000`).
- Times are milliseconds since 1970 (UTC).
- **Vault items stay encrypted** in the file (`enc`); they open only with the
  Vault password. Everything else is plain JSON: keep the file safe.
- Importing never overwrites: anything with an id already on the device is skipped.

## 2. Readable files in your Google Drive (Markdown)

Settings → Sync. A folder named `Stash` with:

| File | What's in it |
|---|---|
| `<Collection>.md` | One per collection: sections, people and places, entries with dates and amounts |
| `Notes.md` | Notes, newest first |
| `Inbox.md` | Inbox messages, newest first |
| `README.md` | What these files are |
| `Stash backup.cps` | Optional full backup (same as above) |
| `stash-sync-*.json` | Two-way sync records between devices (for Stash itself) |

Photos and files are counted, not copied. The Vault is never written. Edits to
these files don't flow back into Stash (the app rewrites them on the next sync).
A collection named Notes, Inbox or README gets " (2)" so nothing clashes.

## 3. Copy for AI (Markdown on the clipboard)

Select notes, Inbox messages, or a collection's current view → **Copy for AI**.
Paste into any AI chat. Stash itself sends nothing anywhere.

```markdown
# From my Stash: Example trip

4 items, copied 12 Oct 2026. These are my own notes and records. Use them to
answer my question; say so if something isn't in them.

## Train to Mysore
- Date: 9 Oct 2026
- Filed in: Example trip › Tickets
- Amount: ₹750
- Attached (not included): 1 photo

Coach B2, seat 41. Leaves 6:15 am.
```

Never included: Vault items, photos and files themselves (only mentioned).

## Note text

A note's text is plain Markdown, whatever editor you write it in: `**bold**`,
`*italic*`, `++underline++`, `~~strike~~`, `==highlight==`, `` `code` ``,
`# heading`, `- list`, `1. list`, `- [ ] tick box` / `- [x] done`, `> quote`.
The rich editor shows these formatted and saves the same text back.

## Next: a connector any AI can use (MCP)

The plan (Phase 3) is a Model Context Protocol connector that runs on the
person's own device and offers these tools, read-only by default, with
per-collection permissions and a log of every read:

| Tool | Does |
|---|---|
| `search(query, when?, collection?)` | Finds notes and entries (time phrases like "last week" work) |
| `get(id)` | One note or entry, in the Copy for AI format |
| `list_collections()` | Collections, sections, people and places |
| `summarise(collection, when?)` | Totals and counts for a period |
| `suggest_to_inbox(text)` | Adds a suggestion to the Inbox; the person approves before anything is filed |

The Vault is never offered to any connector.
