/**
 * Rules the hand-written JSON got wrong. The engine still "parses" them, but
 * into an artifact (e.g. a target that is prose), so no canonical spelling can
 * reproduce that artifact — nor should it. Each one is reported by
 * `validateModel` as an error and gets fixed in its Phase 3 slice; this list
 * must be empty by the cutover.
 */
export const KNOWN_MALFORMED: Record<string, string> = {
  // intent: mirror → Tasks (via: taskID) (display: taskName)
  "Workspace/Jobs.jobName": "computed: via taskID display taskName",
};

/** Attribute-index form of the same entries, for whole-table diffs: "<Module>/<Table>.attributes[i].rule". */
export function isKnownMalformedPath(path: string, attrNameAt: (module: string, table: string, i: number) => string | undefined): boolean {
  const m = /^([^/]+)\/([^.]+)\.attributes\[(\d+)\]\.rule$/.exec(path);
  if (!m) return false;
  const name = attrNameAt(m[1]!, m[2]!, Number(m[3]));
  return name !== undefined && `${m[1]}/${m[2]}.${name}` in KNOWN_MALFORMED;
}
