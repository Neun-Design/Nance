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

// Save — overwrite the session file in place; the very first save (no file
// yet) falls through to Save As so the user picks the folder once.
export async function save(text) {
  if (!state.file) return saveAs(text);
  if (!(await ensureRW(state.file))) throw new Error('write permission denied');
  await writeTo(state.file, text);
  return label();
}

// Save As — pick the folder (the picker's `id` makes the browser reopen the
// current session folder by default), name the file, and remember both as
// the NEW session target. Returns null when the user cancels.
export async function saveAs(text) {
  const dir = await window.showDirectoryPicker({
    id: 'edqms-session', mode: 'readwrite', startIn: state.dir || undefined,
  });
  let name = window.prompt('File name for this session:',
    (state.file && state.file.name) || 'edqms_session.json');
  if (name == null) return null;
  name = name.trim() || 'edqms_session.json';
  if (!/\.json$/i.test(name)) name += '.json';
  const fh = await dir.getFileHandle(name, { create: true });
  await writeTo(fh, text);
  state.dir = dir;
  state.file = fh;
  await idbSet('dir', dir);
  await idbSet('file', fh);
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
