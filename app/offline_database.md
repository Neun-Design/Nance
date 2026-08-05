# Offline database — blank-mode snapshots

The prototype doubles as an **offline mapping tool** for consulting
engagements: the client's operation is registered through the GitHub Pages
build in MVP mode (`/app/mvp/`, locally `?data=empty`), and the session data
travels as plain JSON files — no backend required.

## Save / Save As (2026-08-05)

The session lives in a **real local file** (File System Access API, Chromium):

- **Save** overwrites the session file in place — no timestamped copies pile up. The
  very first save asks for the folder once; after an **Import**, Save writes straight
  back to the imported file's location.
- **Save As** records a new version: the folder picker opens in the current session
  folder by default, you name the file, and it becomes the new Save target.
- The **header chip** (`📄 folder/file.json`) always shows what Save will overwrite; a
  footer toast confirms every save. The target survives reloads (IndexedDB) — the
  browser just re-asks permission on the next Save.
- Non-Chromium browsers fall back to downloading a copy (no in-place writes).

## How it works

Blank mode already persists every registered record to `localStorage`
(`edqms-blank-data`, per browser). Two header buttons (visible **only** in
blank mode) move that store in and out of files:

| Button | Action |
|---|---|
| **Save** | Downloads the session as `edqms_blank_<date>_<time>.json` — same table shape as the mockup dataset, wrapped in `{ _meta, Blank }`. `_meta` stamps app, **schemaVersion** (from the datamodel's `_meta`, bumped on every schema PR), export time and table/record counts. |
| **Import** | Loads a snapshot file back: after a confirmation, it **replaces** the whole session (and re-persists to localStorage). The confirm dialog **warns when the file's schemaVersion differs from the app's**; tables the current build doesn't catalogue are skipped and reported. |

System registries (Countries) never travel in snapshots; they reload from
app data in every mode. Engine entry points: `exportSnapshot()` /
`importSnapshot()` in `js/data.js`; UI wiring in `js/app.js` (blank-mode
block).

## Working agreement (consulting sessions)

1. **One scribe per session.** OneDrive sharing is last-write-wins and record
   ids are generated sequentially per browser — parallel editing of the same
   dataset cannot be merged.
2. **Save at every milestone** and at session end; name by session when
   useful (`edqms_blank_2026-08-05_workshop1.json`). localStorage is a cache,
   not the database — the OneDrive file is the source of truth.
3. **Client data never enters the repo.** GitHub Pages is public; snapshots
   are confidential. `.gitignore` blocks `client-data/` and
   `edqms_blank_*.json`, but the real rule is: snapshots live in the shared
   OneDrive folder only.
4. **Freeze the app for the engagement.** Schema changes weekly on `main`;
   deploy a tagged build for the client and migrate their snapshots
   deliberately between phases. The Import dialog warns on schemaVersion
   mismatch and lists tables the build doesn't recognize, but renamed
   *attributes* inside a table are not detected — hence the freeze.
5. When the MVP is authorized, the accumulated snapshots are the seed data:
   same table shape the migration tooling already consumes.
