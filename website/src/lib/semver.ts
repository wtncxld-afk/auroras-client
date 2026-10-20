// A line-for-line port of compareVersions in the launcher's updater.js, so the website and the launcher always
// agree on which version is newer (tests check both against the same cases).
export function parseVersion(v: string) {
  const m = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(String(v).trim());
  if (!m) throw new Error("Invalid version: " + v);
  return { n: [+m[1], +m[2], +m[3]], pre: m[4] ? m[4].split(".") : [] };
}
export function isVersion(v: string) { try { parseVersion(v); return /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(v); } catch { return false; } }
/** SemVer precedence: 1.0.0-preview.2 < 1.0.0. Returns -1, 0 or 1. */
export function compareVersions(a: string, b: string): number {
  const x = parseVersion(a), y = parseVersion(b);
  for (let i = 0; i < 3; i++) if (x.n[i] !== y.n[i]) return x.n[i] < y.n[i] ? -1 : 1;
  if (!x.pre.length && !y.pre.length) return 0;
  if (!x.pre.length) return 1; if (!y.pre.length) return -1;
  for (let i = 0; i < Math.max(x.pre.length, y.pre.length); i++) {
    const p = x.pre[i], q = y.pre[i];
    if (p === undefined) return -1; if (q === undefined) return 1;
    const pn = /^\d+$/.test(p), qn = /^\d+$/.test(q);
    if (pn && qn) { if (+p !== +q) return +p < +q ? -1 : 1; }
    else if (pn) return -1; else if (qn) return 1; else if (p !== q) return p < q ? -1 : 1;
  }
  return 0;
}
export const newestFirst = <T extends { version: string }>(a: T, b: T) => compareVersions(b.version, a.version);
