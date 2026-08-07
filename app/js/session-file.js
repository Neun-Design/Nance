// session-file.js — blank/MVP-mode session persistence to a REAL local file
// (File System Access API, Chromium). Save overwrites the session file in
// place — no timestamped copies; Save As writes a new version (the picker
// opens in the current session folder); Import makes the picked file the new
// Save target. Handles persist in IndexedDB so a reload keeps the target
// (permission is re-requested on the next Save click, which counts as the
// user activation the API requires).

const DB = 'edqms-fs';
const STORE = 'handles';

function idb() {
  return new Promise((res, rej) => {
    const rq = indexedDB.open(DB, 1);
    rq.onupgradeneeded = () => rq.result.createObjectStore(STORE);
    rq.onsuccess = () => res(rq.result);
    rq.onerror = () => rej(rq.error);
  });
}
async function idbGet(key) {
  try {
    const db = await idb();
    return await new Promise((res) => {
      const rq = db.transaction(STORE).objectStore(STORE).get(key);
      rq.onsuccess = () => res(rq.result || null);
      rq.onerror = () => res(null);
    });
  } catch { return null; }
}
async function idbSet(key, val) {
  try {
    const db = await idb();
    await new Promise((res) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(val, key);
      tx.oncomplete = res;
      tx.onerror = res;
    });
  } catch { /* private mode — session-only handles */ }
}

export const supported = typeof window !== 'undefined' && 'showDirectoryPicker' in window;

const state = { dir: null, file: null };

// header chip text: "<folder>/<file>" — the folder is the LAST path segment
// (the API never exposes full paths); unknown-folder imports show just the name
export function label() {
  if (!state.file) return null;
  return (state.dir ? `${state.dir.name}/` : '') + state.file.name;
}

export async function restoreHandles() {
  if (!supported) return null;
  state.dir = await idbGet('dir');
  state.file = await idbGet('file');
  return label();
}

async function ensureRW(handle) {
  if ((await handle.queryPermission({ mode: 'readwrite' })) === 'granted') return true;
  return (await handle.requestPermission({ mode: 'readwrite' })) === 'granted';
}

async function writeTo(handle, text) {
  const w = await handle.createWritable();
  await w.write(text);
  await w.close();
}

async function remember(dir, fh) {
  state.dir = dir;
  state.file = fh;
  await idbSet('dir', dir);
  await idbSet('file', fh);
}

// Save — overwrite the session file in place. The FIRST save asks only for
// the FOLDER (per the spec) and creates edqms_session.json inside it — no
// window.prompt anywhere: Chrome can suppress sync dialogs right after an
// async picker, which made the first save die silently (2026-08-07 fix).
export async function save(text) {
  if (!state.file) {
    const opts = { id: 'edqms-session', mode: 'readwrite' };
    if (state.dir) opts.startIn = state.dir;
    const dir = await window.showDirectoryPicker(opts);
    const fh = await dir.getFileHandle('edqms_session.json', { create: true });
    await writeTo(fh, text);
    await remember(dir, fh);
    return label();
  }
  if (!(await ensureRW(state.file))) throw new Error('write permission denied');
  await writeTo(state.file, text);
  return label();
}

// Save As — ONE native save dialog (browse + name in the same window),
// opening in the session folder by default (picker id + startIn). The
// folder chip survives when the new file lands inside the known folder
// (resolve() proves it); elsewhere the chip shows just the file name.
export async function saveAs(text) {
  const opts = {
    id: 'edqms-session',
    suggestedName: (state.file && state.file.name) || 'edqms_session.json',
    types: [{ description: 'EDQMS session', accept: { 'application/json': ['.json'] } }],
  };
  if (state.dir) opts.startIn = state.dir;
  const fh = await window.showSaveFilePicker(opts);
  await writeTo(fh, text);
  let insideDir = false;
  if (state.dir) {
    try { insideDir = (await state.dir.resolve(fh)) != null; } catch { /* permission — assume outside */ }
  }
  await remember(insideDir ? state.dir : null, fh);
  return label();
}

// Import — the picked file BECOMES the session target (Save overwrites it,
// exactly where it was imported from). The folder chip survives only when
// the file sits inside the known session folder (resolve() proves it).
export async function importPick() {
  const [fh] = await window.showOpenFilePicker({
    id: 'edqms-session',
    types: [{ description: 'EDQMS session', accept: { 'application/json': ['.json'] } }],
    startIn: state.dir || undefined,
  });
  const text = await (await fh.getFile()).text();
  let insideDir = false;
  if (state.dir) {
    try { insideDir = (await state.dir.resolve(fh)) != null; } catch { /* permission — assume outside */ }
  }
  state.file = fh;
  if (!insideDir) state.dir = null;
  await idbSet('file', fh);
  await idbSet('dir', state.dir);
  return { name: fh.name, text, label: label() };
}
