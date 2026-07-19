// router.js — minimal hash router. Route form: #/<moduleIndex>/<tabIndex>

export function parseHash() {
  const m = location.hash.match(/^#\/(\d+)\/(\d+)/);
  if (!m) return null;
  return { module: Number(m[1]), tab: Number(m[2]) };
}

export function go(moduleIdx, tabIdx) {
  location.hash = `#/${moduleIdx}/${tabIdx}`;
}

export function onRoute(handler) {
  window.addEventListener('hashchange', handler);
}
