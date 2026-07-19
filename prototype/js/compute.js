// compute.js — retired enrichment pass. The registry-era enrichAll precomputed
// mirror fields onto rows; the datamodel engine now derives FK displays,
// rollups and computed values at render time (see resolve.js). Kept as a
// no-op so callers keep a single "data changed" hook.

export function enrichAll() { /* engine derives values at render time */ }
